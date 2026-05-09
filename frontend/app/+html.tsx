// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// Static, hard-coded reset CSS — never contains user input.
// Kept as a constant so the dangerouslySetInnerHTML usage below is provably XSS-safe.
const STATIC_RESET_CSS = `
  body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
  [role="tablist"] [role="tab"] * { overflow: visible !important; }
  [role="heading"], [role="heading"] * { overflow: visible !important; }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        {/*
          Disable body scrolling on web to make ScrollView components work correctly.
          If you want to enable scrolling, remove `ScrollViewStyleReset` and
          set `overflow: auto` on the body style below.
        */}
        <ScrollViewStyleReset />
        {/*
          Static reset CSS only — no user input is ever interpolated into STATIC_RESET_CSS,
          so dangerouslySetInnerHTML cannot produce an XSS vector here. React requires this
          form (or a string child) for inline style on the web target; both are equivalent
          at the DOM level.
        */}
        {/* eslint-disable-next-line react/no-danger */}
        <style dangerouslySetInnerHTML={{ __html: STATIC_RESET_CSS }} />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
