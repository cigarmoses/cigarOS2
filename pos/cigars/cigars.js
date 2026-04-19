function ensureInjectedStyles() {
  if ($("#cigars-inline-filter-style")) return;

  const style = document.createElement("style");
  style.id = "cigars-inline-filter-style";
  style.textContent = `
    .fm.fm--tabs .fm__sheet{
      max-height:88vh;
      background:rgba(255,255,255,.86);
      border:1px solid rgba(15,26,44,.08);
      box-shadow:
        0 30px 80px rgba(15,26,44,.18),
        inset 0 1px 0 rgba(255,255,255,.55);
      backdrop-filter:blur(28px) saturate(1.18);
      -webkit-backdrop-filter:blur(28px) saturate(1.18);
    }

    .fm.fm--tabs .fm__header{
      position:relative;
      padding:20px 18px 10px;
      border-bottom:none;
      background:transparent;
    }

    .fm.fm--tabs .fm__header-top{
      display:block;
      margin-bottom:0;
    }

    .fm.fm--tabs .fm__header-left{
      display:block;
      min-width:0;
      padding-right:64px;
    }

    .fm.fm--tabs .fm__title{
      margin:0;
      font-weight:800;
      letter-spacing:-.035em;
      color:#0f1a2c;
    }

    .fm.fm--tabs .fm__close{
      position:absolute;
      top:18px;
      right:18px;
      width:44px;
      height:44px;
      border-radius:16px;
      border:1px solid rgba(15,26,44,.08);
      background:rgba(255,255,255,.68);
      backdrop-filter:blur(20px) saturate(1.15);
      -webkit-backdrop-filter:blur(20px) saturate(1.15);
      box-shadow:
        0 10px 24px rgba(15,26,44,.10),
        inset 0 1px 0 rgba(255,255,255,.6);
      display:grid;
      place-items:center;
      cursor:pointer;
      padding:0;
      appearance:none;
      z-index:4;
    }

    .fm.fm--tabs .fm__close svg{
      width:18px;
      height:18px;
    }

    .fm.fm--tabs .fm__body{
      display:block;
      padding:0;
      overflow:hidden;
    }

    .fm.fm--tabs .fm__tabbar{
      display:flex;
      gap:10px;
      overflow:auto;
      padding:0 18px 14px;
      -ms-overflow-style:none;
      scrollbar-width:none;
      scroll-behavior:smooth;
    }

    .fm.fm--tabs .fm__tabbar::-webkit-scrollbar{
      display:none;
    }

    .fm.fm--tabs .fm__tab{
      flex:0 0 auto;
      min-height:40px;
      padding:0 15px;
      border-radius:999px;
      border:1px solid rgba(15,26,44,.07);
      background:rgba(255,255,255,.62);
      backdrop-filter:blur(18px) saturate(1.12);
      -webkit-backdrop-filter:blur(18px) saturate(1.12);
      color:rgba(15,26,44,.62);
      font-family:var(--font-display, -apple-system, BlinkMacSystemFont, system-ui, sans-serif);
      font-size:15px;
      font-weight:600;
      letter-spacing:-.01em;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:8px;
      cursor:pointer;
      appearance:none;
      white-space:nowrap;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.55);
    }

    .fm.fm--tabs .fm__tab.is-active{
      background:rgba(255,255,255,.92);
      color:#0f1a2c;
      border-color:rgba(15,26,44,.08);
      box-shadow:
        0 10px 24px rgba(15,26,44,.10),
        inset 0 1px 0 rgba(255,255,255,.7);
    }

    .fm.fm--tabs .fm__tab-count{
      min-width:18px;
      height:18px;
      padding:0 6px;
      border-radius:999px;
      background:rgba(15,122,255,.12);
      color:#0f7aff;
      font-size:11px;
      font-weight:700;
      display:grid;
      place-items:center;
    }

    .fm.fm--tabs .fm__panel{
      display:flex;
      flex-direction:column;
      min-height:0;
      max-height:calc(88vh - 198px);
    }

    .fm.fm--tabs .fm__search-wrap{
      padding:0 18px 10px;
    }

    .fm.fm--tabs .fm__search-row{
      margin:0;
      display:grid;
      grid-template-columns:22px 1fr 36px;
      gap:10px;
      align-items:center;
      min-height:56px;
      padding:0 16px;
      border-radius:20px;
      border:1px solid rgba(15,26,44,.06);
      background:rgba(255,255,255,.68);
      backdrop-filter:blur(20px) saturate(1.14);
      -webkit-backdrop-filter:blur(20px) saturate(1.14);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.58),
        0 8px 18px rgba(15,26,44,.06);
    }

    .fm.fm--tabs .fm__search-row svg{
      color:rgba(15,26,44,.42);
    }

    .fm.fm--tabs .fm__search-input{
      font-weight:500;
      font-size:17px;
      color:#0f1a2c;
    }

    .fm.fm--tabs .fm__search-input::placeholder{
      color:rgba(15,26,44,.36);
    }

    .fm.fm--tabs .fm__mic-btn{
      width:36px;
      height:36px;
      border-radius:12px;
      border:0;
      background:rgba(15,26,44,.04);
      display:grid;
      place-items:center;
      appearance:none;
    }

    .fm.fm--tabs .fm__cuban-row{
      padding:0 18px 14px;
    }

    .fm.fm--tabs .fm__cuban-toggle{
      border:0;
      background:transparent;
      padding:0;
      margin:6px 0 0;
      display:inline-flex;
      align-items:center;
      gap:10px;
      cursor:pointer;
      appearance:none;
      color:#0f1a2c;
      font-family:var(--font-display, -apple-system, BlinkMacSystemFont, system-ui, sans-serif);
      font-size:16px;
      font-weight:600;
      letter-spacing:-.01em;
      align-self:flex-start;
    }

    .fm.fm--tabs .fm__cuban-check{
      width:24px;
      height:24px;
      border-radius:8px;
      border:2px solid rgba(15,26,44,.14);
      background:rgba(255,255,255,.75);
      display:grid;
      place-items:center;
      font-size:15px;
      line-height:1;
      color:transparent;
      flex:0 0 auto;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.6);
    }

    .fm.fm--tabs .fm__cuban-toggle.is-on .fm__cuban-check{
      background:#34c759;
      border-color:#34c759;
      color:#fff;
      box-shadow:0 8px 18px rgba(52,199,89,.24);
    }

    .fm.fm--tabs .fm__list{
      overflow:auto;
      padding:0 18px 12px;
    }

    .fm.fm--tabs .fm__row{
      display:grid;
      grid-template-columns:30px minmax(0,1fr) auto 150px;
      gap:12px;
      align-items:center;
      min-height:58px;
      padding:10px 12px;
      border-radius:18px;
      border:1px solid rgba(15,26,44,.06);
      background:rgba(255,255,255,.64);
      backdrop-filter:blur(16px) saturate(1.08);
      -webkit-backdrop-filter:blur(16px) saturate(1.08);
      margin-bottom:10px;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.56),
        0 8px 18px rgba(15,26,44,.05);
      transition:transform .14s ease, box-shadow .14s ease, background .14s ease;
    }

    .fm.fm--tabs .fm__row:active{
      transform:scale(.992);
    }

    .fm.fm--tabs .fm__row--logo{
      grid-template-columns:30px 42px minmax(0,1fr);
    }

    .fm.fm--tabs .fm__cb{
      width:22px;
      height:22px;
      border-radius:7px;
      border:2px solid rgba(15,26,44,.16);
      background:rgba(255,255,255,.82);
      display:grid;
      place-items:center;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.65);
    }

    .fm.fm--tabs .fm__cb.is-checked{
      background:rgba(15,122,255,.12);
      border-color:rgba(15,122,255,.42);
      color:#0f7aff;
    }

    .fm.fm--tabs .fm__cb svg{
      width:14px;
      height:14px;
    }

    .fm.fm--tabs .fm__label{
      min-width:0;
      font-family:var(--font-display, -apple-system, BlinkMacSystemFont, system-ui, sans-serif);
      font-size:17px;
      font-weight:600;
      letter-spacing:-.02em;
      color:#0f1a2c;
    }

    .fm.fm--tabs .fm__info{
      width:24px;
      height:24px;
      border:0;
      background:transparent;
      color:#97a0b0;
      font-size:16px;
      font-weight:500;
      line-height:1;
      display:grid;
      place-items:center;
      cursor:pointer;
      padding:0;
      appearance:none;
    }

    .fm.fm--tabs .fm__icon{
      width:150px;
      min-width:150px;
      height:22px;
      display:flex;
      align-items:center;
      justify-content:flex-start;
      overflow:visible;
    }

    .fm.fm--tabs .fm__icon img{
      height:12px;
      width:auto;
      max-width:118px;
      object-fit:contain;
      display:block;
      transform:scaleX(-1);
      transform-origin:center;
    }

    .fm.fm--tabs .fm__icon img.fm__icon-robusto{
      transform:scaleX(-1) rotate(180deg);
    }

    .fm.fm--tabs .fm__icon--brand,
    .fm.fm--tabs .fm__icon--manufacturer{
      width:42px;
      min-width:42px;
      height:42px;
      justify-content:center;
    }

    .fm.fm--tabs .fm__icon--brand img,
    .fm.fm--tabs .fm__icon--manufacturer img{
      width:36px;
      height:36px;
      max-width:36px;
      object-fit:contain;
      transform:none;
    }

    .fm.fm--tabs .fm__btn{
      font-weight:700;
      height:58px;
      border-radius:20px;
      backdrop-filter:blur(16px);
      -webkit-backdrop-filter:blur(16px);
    }

    .fm.fm--tabs .fm__btn--reset{
      background:rgba(15,26,44,.06);
      color:#0f1a2c;
      border:1px solid rgba(15,26,44,.06);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.55);
    }

    .fm.fm--tabs .fm__btn--apply{
      background:rgba(10,132,255,.92);
      color:#fff;
      box-shadow:0 14px 28px rgba(10,132,255,.22);
    }

    .fm.fm--tabs .fm__info-sheet{
      position:absolute;
      left:18px;
      right:18px;
      bottom:92px;
      border-radius:22px;
      background:rgba(255,255,255,.9);
      border:1px solid rgba(15,26,44,.08);
      box-shadow:0 18px 40px rgba(15,26,44,.14);
      backdrop-filter:blur(22px) saturate(1.12);
      -webkit-backdrop-filter:blur(22px) saturate(1.12);
      padding:14px 16px;
      display:none;
    }

    .fm.fm--tabs .fm__info-sheet.is-open{
      display:block;
    }

    .fm.fm--tabs .fm__info-title{
      margin:0 0 6px;
      font-size:18px;
      line-height:1.2;
      font-weight:700;
      color:#0f1a2c;
    }

    .fm.fm--tabs .fm__info-text{
      margin:0;
      font-size:15px;
      line-height:1.35;
      font-weight:500;
      color:rgba(15,26,44,.72);
    }

    .fm.fm--tabs .fm__info-close{
      position:absolute;
      top:10px;
      right:10px;
      width:28px;
      height:28px;
      border:0;
      background:transparent;
      color:#8d96a8;
      font-size:22px;
      line-height:1;
      display:grid;
      place-items:center;
      cursor:pointer;
      padding:0;
      appearance:none;
    }

    .fm.fm--tabs .fm__actions{
      position:relative;
      z-index:2;
      background:rgba(255,255,255,.82);
      backdrop-filter:blur(22px) saturate(1.12);
      -webkit-backdrop-filter:blur(22px) saturate(1.12);
    }

    .fm.fm--tabs .fm__empty{
      padding:16px 6px 10px;
      color:rgba(15,26,44,.48);
      font-size:16px;
      font-weight:500;
    }

    @media (max-width:430px){
      .fm.fm--tabs .fm__header{
        padding:20px 18px 10px;
      }

      .fm.fm--tabs .fm__close{
        top:18px;
        right:18px;
      }

      .fm.fm--tabs .fm__cuban-toggle{
        font-size:15px;
      }

      .fm.fm--tabs .fm__panel{
        max-height:calc(88vh - 194px);
      }

      .fm.fm--tabs .fm__row{
        grid-template-columns:28px minmax(0,1fr) auto 132px;
        gap:10px;
        min-height:56px;
        padding:10px 10px;
      }

      .fm.fm--tabs .fm__row--logo{
        grid-template-columns:28px 40px minmax(0,1fr);
      }

      .fm.fm--tabs .fm__icon{
        width:132px;
        min-width:132px;
      }

      .fm.fm--tabs .fm__icon img{
        max-width:104px;
        height:12px;
      }

      .fm.fm--tabs .fm__icon--brand,
      .fm.fm--tabs .fm__icon--manufacturer{
        width:40px;
        min-width:40px;
        height:40px;
      }

      .fm.fm--tabs .fm__icon--brand img,
      .fm.fm--tabs .fm__icon--manufacturer img{
        width:34px;
        height:34px;
        max-width:34px;
      }

      .fm.fm--tabs .fm__label{
        font-size:16px;
      }
    }

    @media (max-width:390px){
      .fm.fm--tabs .fm__row{
        grid-template-columns:26px minmax(0,1fr) auto 118px;
        gap:8px;
      }

      .fm.fm--tabs .fm__row--logo{
        grid-template-columns:26px 38px minmax(0,1fr);
      }

      .fm.fm--tabs .fm__icon{
        width:118px;
        min-width:118px;
      }

      .fm.fm--tabs .fm__icon img{
        max-width:90px;
        height:11px;
      }

      .fm.fm--tabs .fm__icon--brand,
      .fm.fm--tabs .fm__icon--manufacturer{
        width:38px;
        min-width:38px;
        height:38px;
      }

      .fm.fm--tabs .fm__icon--brand img,
      .fm.fm--tabs .fm__icon--manufacturer img{
        width:32px;
        height:32px;
        max-width:32px;
      }

      .fm.fm--tabs .fm__tab{
        padding:0 12px;
        font-size:14px;
      }

      .fm.fm--tabs .fm__cuban-toggle{
        font-size:14px;
      }
    }
  `;
  document.head.appendChild(style);
}
