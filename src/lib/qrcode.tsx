import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";

export type ProductQrPayload = {
  name: string;
  sku: string;
  category?: string;
  price?: number;
  stock?: number;
};

export function buildProductQrValue(product: ProductQrPayload) {
  return JSON.stringify({
    name: product.name,
    sku: product.sku,
    category: product.category || "",
    price: product.price ?? 0,
    stock: product.stock ?? 0,
  });
}

export async function downloadProductQrCode(product: ProductQrPayload, fileName?: string) {
  const value = buildProductQrValue(product);
  const baseName = (fileName || `${product.name.replace(/\s+/g, "-").toLowerCase()}-qr`).replace(/\.(png|svg)$/i, "");

  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:-9999px";
  document.body.appendChild(container);

  const { createRoot } = await import("react-dom/client");
  const root = createRoot(container);
  root.render(
    <QRCodeCanvas value={value} size={320} level="H" includeMargin={true} bgColor="#ffffff" fgColor="#111827" />
  );

  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  const canvas = container.querySelector("canvas");
  if (canvas) {
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${baseName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  root.unmount();
  container.remove();
}
