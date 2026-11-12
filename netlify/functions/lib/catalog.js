      function normalizeHeader(h){
        return String(h || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ")
          .replace(/[^a-z0-9 ]/g, "")
          .replace(/ /g, "_");
      }

      function parseCSV(text){
        const rows = [];
        let cur = [];
        let field = "";
        let inQuotes = false;

        for(let i = 0; i < text.length; i++){
          const ch = text[i];
          const next = text[i + 1];

          if(inQuotes){
            if(ch === '"' && next === '"'){
              field += '"';
              i++;
            }else if(ch === '"'){
              inQuotes = false;
            }else{
              field += ch;
            }
          }else{
            if(ch === '"') inQuotes = true;
            else if(ch === ","){
              cur.push(field);
              field = "";
            }else if(ch === "\n"){
              cur.push(field);
              rows.push(cur);
              cur = [];
              field = "";
            }else if(ch !== "\r"){
              field += ch;
            }
          }
        }

        cur.push(field);
        rows.push(cur);
        return rows;
      }

      function mapRows(csv){
        const headers = csv[0] || [];
        const keys = headers.map(normalizeHeader);

        return csv.slice(1)
          .map((r, index) => {
            if(!r || r.every((c) => !String(c || "").trim()))return null;
            const obj = {__hubSheetRow:index+2};
            keys.forEach((k, i) => {
              obj[k] = (r[i] ?? "").trim();
            });
            return obj;
          }).filter(Boolean);
      }

      async function recoverPublicationRanks(rows, {sheetUrl, signal, headers} = {}) {
        if (!Array.isArray(rows)) throw new TypeError('Hub rows must be an array.');
        const recovered = rows.map(row => ({...row}));
        const present = value => value != null && String(value).trim() !== '';
        // Resolve physical rank columns from this response's headers. HUB columns
        // can move when fields are inserted; old fixed letters silently lost ties.
        const headerKeys = Array.isArray(headers) ? headers.map(normalizeHeader) : [];
        const columnFor = field => {
          const index = headerKeys.indexOf(field);
          if (index < 0 || headerKeys.lastIndexOf(field) !== index) {
            throw new Error(`A unique HUB header is required to recover ${field}.`);
          }
          let number = index + 1, column = '';
          while (number > 0) {
            number--;
            column = String.fromCharCode(65 + number % 26) + column;
            number = Math.floor(number / 26);
          }
          return column;
        };
        const pairs = [
          ['hw_consensus_year', 'hw_consensus_rank'],
          ['cigar_aficionado_top_25_year', 'cigar_aficionado_top_25_rank'],
          ['cigar_journal_top_25_year', 'cigar_journal_top_25_rank']
        ];
        const controller = new AbortController();
        const forwardAbort = () => controller.abort(signal.reason);
        const checkAbort = () => {
          if (controller.signal.aborted) {
            throw controller.signal.reason || new DOMException('The operation was aborted.', 'AbortError');
          }
        };
        if (signal?.aborted) forwardAbort();
        else signal?.addEventListener('abort', forwardAbort, {once:true});
        try {
          checkAbort();
          const jobs = [];
          for (const [yearField, rankField] of pairs) {
            const candidates = recovered.filter(row => present(row[yearField]) && !present(row[rankField]));
            if (!candidates.length) continue;
            const column = columnFor(rankField);
            for (const row of candidates) {
              if (!Number.isInteger(row.__hubSheetRow) || row.__hubSheetRow < 2) {
                throw new Error('A physical Hub row number is required to recover its rank.');
              }
            }
            candidates.sort((a,b) => a.__hubSheetRow - b.__hubSheetRow);
            let run = null;
            for (const row of candidates) {
              const number = row.__hubSheetRow;
              if (run && number === run.end) throw new Error('Duplicate physical Hub row number.');
              if (!run || number !== run.end + 1) {
                run = {column, rankField, start:number, end:number, rows:[row]};
                jobs.push(run);
              } else {
                run.end = number;
                run.rows.push(row);
              }
            }
          }
          if (!jobs.length) return recovered;
          const base = new URL(sheetUrl);
          if (base.hostname !== 'docs.google.com' || !/^\/spreadsheets\/d\/[^/]+\/gviz\/tq$/.test(base.pathname)) {
            throw new Error('A public Google Visualization Hub URL is required.');
          }
          let cursor = 0;
          async function recoverRun(job) {
            checkAbort();
            const url = new URL(base.href);
            url.searchParams.set('tqx', 'out:json');
            url.searchParams.set('headers', '0');
            url.searchParams.set('range', `${job.column}${job.start}:${job.column}${job.end}`);
            url.searchParams.delete('tq');
            const response = await fetch(url.href, {cache:'no-store', credentials:'omit', signal:controller.signal});
            if (!response.ok) throw new Error(`Hub rank recovery failed (${response.status}).`);
            let body = (await response.text()).trim().replace(/^\uFEFF/, '').replace(/^\/\*O_o\*\/\s*/, '');
            checkAbort();
            const wrapper = body.match(/^google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/);
            if (wrapper) body = wrapper[1];
            else if (!body.startsWith('{')) throw new Error('Hub rank recovery returned an invalid response.');
            let payload;
            try { payload = JSON.parse(body); }
            catch { throw new Error('Hub rank recovery returned invalid JSON.'); }
            const table = payload?.table;
            if (payload.status !== 'ok' || !table || !Array.isArray(table.cols) || table.cols.length !== 1 ||
                table.cols[0]?.id !== job.column || !Array.isArray(table.rows) || table.rows.length > job.rows.length) {
              throw new Error('Hub rank recovery returned an invalid table.');
            }
            // Empty ranges and omitted trailing blank rows remain blank; never shift null cells.
            table.rows.forEach((item, offset) => {
              if (item == null) return;
              if (!Array.isArray(item.c) || item.c.length > 1) throw new Error('Hub rank recovery returned an invalid row.');
              const cell = item.c[0];
              if (cell == null) return;
              if (typeof cell !== 'object' || Array.isArray(cell)) throw new Error('Hub rank recovery returned an invalid cell.');
              const value = cell.f != null ? cell.f : cell.v;
              if (value == null) return;
              if (!['string','number'].includes(typeof value)) throw new Error('Hub rank recovery returned an invalid rank.');
              const row = job.rows[offset];
              if (present(value) && !present(row[job.rankField])) row[job.rankField] = String(value).trim();
            });
          }
          async function worker() {
            while (cursor < jobs.length) {
              checkAbort();
              const job = jobs[cursor++];
              try { await recoverRun(job); }
              catch (error) { controller.abort(error); throw error; }
            }
          }
          await Promise.all(Array.from({length:Math.min(4, jobs.length)}, worker));
          checkAbort();
          return recovered;
        } finally {
          signal?.removeEventListener('abort', forwardAbort);
        }
      }


export {parseCSV,mapRows,recoverPublicationRanks};
