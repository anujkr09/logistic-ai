# TODO - Theme Change

## Step 1: Repo understanding (done)
- Located theme variables in `frontend/assets/css/style.css`
- Identified page-level usage via `frontend/index.html` and `frontend/pages/*.html`
- Identified theme-dependent CSS: `dashboard.css`, `tracking.css`, `auth.css`, `chatbot.css`

## Step 2: Implement new design system (approved)
- Update `frontend/assets/css/style.css` (variables + brand colors)
- Update component styles in `dashboard.css`, `tracking.css`, `auth.css`, `chatbot.css` (partially updated)
- Remaining: replace remaining hardcoded legacy ZYRAVIQ colors across CSS to fully match new theme (style/dashboard/tracking/auth/chatbot)




## Step 3: Ensure every page is updated
- Verify/adjust `<body>` classes in all pages + `index.html`
- Ensure global header/footer/search/chatbot visuals match new theme

## Step 4: JS consistency check
- Verify theme toggle logic in `frontend/assets/js/app.js` still works

## Step 5: Testing
- Quick manual check: open index + each page URL
- Validate chatbot appearance and theme toggle

