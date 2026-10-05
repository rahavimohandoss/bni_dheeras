import { ImageResponse } from "next/og";

/** Square app icon: white "BNI / Dheeras" on BNI Red. */
export function renderAppIcon(size: number, opts: { rounded?: boolean } = {}) {
  const small = size < 64;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#cf2030",
          color: "#ffffff",
          borderRadius: opts.rounded ? size * 0.2 : 0,
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ fontSize: small ? size * 0.5 : size * 0.3, fontWeight: 800, letterSpacing: -1 }}>
          {small ? "D" : "BNI"}
        </div>
        {small ? null : (
          <div style={{ fontSize: size * 0.13, fontWeight: 700, marginTop: size * 0.01 }}>Dheeras</div>
        )}
      </div>
    ),
    { width: size, height: size },
  );
}
