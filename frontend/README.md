# Frontend structure

The frontend is organized by feature. UI components stay with the feature they serve, while each feature's API calls live in its `api/` folder.

```text
src/
├── App.jsx                         # App routing, session state, and workspace composition
├── main.jsx                        # React entry point
├── components/
│   └── icons.jsx                   # Shared SVG icons
├── features/
│   ├── activity/components/        # Recent stock activity and activity chart
│   ├── admin/
│   │   ├── api/                    # Admin user API calls
│   │   └── components/             # User management UI
│   ├── auth/
│   │   ├── api/                    # Login, signup, session, and logout calls
│   │   └── components/             # Login and signup UI
│   ├── dashboard/components/      # Dashboard stat cards
│   ├── landing/components/         # Landing page market preview
│   └── market/
│       ├── api/                    # Market watch and stock detail API calls
│       └── components/             # Market table, node graph, charts, and details
├── lib/
│   ├── config.js                   # API base URL and docs URL
│   ├── formatters.js               # Shared price and date formatting
│   ├── http.js                     # Shared JSON request and API error handling
│   └── routes.js                   # Frontend path helpers
└── styles.css                      # Global and responsive styles
```

API flow: feature components call their feature service; feature services use `lib/http.js` for credentials, JSON parsing, and consistent API errors. `App.jsx` owns the signed-in session and chooses which workspace section to render.
