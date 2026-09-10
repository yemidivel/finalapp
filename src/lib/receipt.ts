import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

export const generateReceiptPDF = (data: {
  store: any;
  transactionId: string;
  date: string;
  cashier: string;
  customer: string;
  items: any[];
  subtotal: number;
  discount: number;
  vat?: number;
  total: number;
  paymentMethod: string;
  currency: any;
  terminalId?: string;
  changeDue?: number;
  receiptDefaults?: any;
}) => {
  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = 20;

    const currencySymbol =
      data.currency?.id === "NGN" ? "NGN " : data.currency?.symbol || "";
    const formatValue = (val: number) =>
      `${currencySymbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const storeName = data.store?.name || "Retail Store";
    const storeAddress = [
      data.store?.address,
      data.store?.city,
      data.store?.state,
    ]
      .filter(Boolean)
      .join(", ");
    const storePhone =
      data.store?.phone || data.receiptDefaults?.phone || "N/A";
    const storeEmail = data.store?.email || data.receiptDefaults?.email || "";
    const storeTin = data.store?.tin || data.receiptDefaults?.tin || "";
    const showLogo = data.receiptDefaults?.showLogo !== false;
    const showReturnPolicy = data.receiptDefaults?.showReturnPolicy !== false;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(42);
    doc.setTextColor(229, 231, 235);
    doc.text("SellSync", pageWidth / 2, pageHeight / 2, {
      align: "center",
      angle: 35,
    });

    doc.setTextColor(17, 24, 39);
    const logoUrl = data.store?.logo || "/icon.png";
    if (showLogo) {
      try {
        doc.addImage(logoUrl, "PNG", margin, y, 18, 18);
      } catch (err) {
        // Fallback to a branded box if image loading fails
        doc.setFillColor(59, 130, 246); // SellSync Blue
        doc.roundedRect(margin, y, 18, 18, 3, 3, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("S", margin + 9, y + 12, { align: "center" });
        doc.setTextColor(17, 24, 39);
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(storeName, pageWidth / 2, y, { align: "center" });
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    if (storeAddress) {
      const addr = doc.splitTextToSize(storeAddress, pageWidth - margin * 2);
      doc.text(addr, pageWidth / 2, y, { align: "center" });
      y += addr.length * 4.5;
    }
    doc.text(`Phone: ${storePhone}`, pageWidth / 2, y, { align: "center" });
    y += 4.5;
    doc.text(`TIN: ${storeTin || "Not set"}`, pageWidth / 2, y, {
      align: "center",
    });
    y += 4.5;

    if (data.receiptDefaults?.header) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(9);
      const headerLines = doc.splitTextToSize(
        String(data.receiptDefaults.header),
        pageWidth - margin * 2,
      );
      doc.text(headerLines, pageWidth / 2, y, { align: "center" });
      y += headerLines.length * 4.5;
    }

    y += 2;
    doc.setDrawColor(209, 213, 219);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(10);
    doc.text("TRANSACTION DETAILS", margin, y);
    y += 5.5;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(75, 85, 99);
    const metaRows: [string, string][] = [
      ["Receipt/Invoice No", data.transactionId || "N/A"],
      ["Date & Time", data.date || new Date().toLocaleString("en-GB")],
      ["Cashier", data.cashier || "N/A"],
      ["POS Terminal ID", data.terminalId || data.store?.code || "N/A"],
      ["Payment Method", data.paymentMethod || "N/A"],
    ];

    metaRows.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(value), margin + 45, y);
      y += 5;
    });

    y += 1;
    doc.setDrawColor(209, 213, 219);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["ITEM", "QTY", "UNIT PRICE", "TOTAL"]],
      body: (data.items || []).map((item) => [
        {
          content: `${item.name || "Item"}${item.sku ? `\nSKU: ${item.sku}` : ""}${item.expiryDate && data.receiptDefaults?.showExpiry !== false ? `\nEXP: ${new Date(item.expiryDate).toLocaleDateString("en-GB")}` : ""}`,
          styles: { fontSize: 8 },
        },
        (item.qty || 0).toString(),
        formatValue(item.price || 0),
        formatValue((item.price || 0) * (item.qty || 0)),
      ]),
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: [31, 41, 55],
        valign: "middle",
        lineColor: [229, 231, 235],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [243, 244, 246],
        textColor: [17, 24, 39],
        fontStyle: "bold",
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 14, halign: "center" },
        2: { cellWidth: 30, halign: "right" },
        3: { cellWidth: 30, halign: "right" },
      },
      margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    const totalsX = pageWidth - margin - 70;

    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.setFont("helvetica", "normal");
    doc.text("Sub-total:", totalsX, y);
    doc.setTextColor(17, 24, 39);
    doc.text(formatValue(data.subtotal || 0), pageWidth - margin, y, {
      align: "right",
    });
    y += 6;

    if (data.discount > 0) {
      doc.setTextColor(75, 85, 99);
      doc.text("Discount:", totalsX, y);
      doc.setTextColor(220, 38, 38);
      doc.text(`-${formatValue(data.discount || 0)}`, pageWidth - margin, y, {
        align: "right",
      });
      y += 6;
    }

    doc.setDrawColor(209, 213, 219);
    doc.line(totalsX, y, pageWidth - margin, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.text("GRAND TOTAL:", totalsX, y);
    doc.setTextColor(0, 0, 0);
    doc.text(formatValue(data.total || 0), pageWidth - margin, y, {
      align: "right",
    });
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(75, 85, 99);
    doc.text("Payment Method:", totalsX, y);
    doc.setTextColor(17, 24, 39);
    doc.text(data.paymentMethod || "N/A", pageWidth - margin, y, {
      align: "right",
    });
    y += 6;

    if (data.changeDue && data.changeDue > 0) {
      doc.setTextColor(75, 85, 99);
      doc.text("Change Due:", totalsX, y);
      doc.setTextColor(17, 24, 39);
      doc.text(formatValue(data.changeDue), pageWidth - margin, y, {
        align: "right",
      });
      y += 6;
    }

    y += 6;
    doc.setDrawColor(209, 213, 219);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    doc.setFont("helvetica", "normal");

    const returnPolicy =
      data.receiptDefaults?.returnPolicy ||
      "Exchange allowed within 48 hours with receipt.";
    const thankYou =
      data.receiptDefaults?.footer || "Thank you for your patronage.";

    if (showReturnPolicy && returnPolicy) {
      const policyLines = doc.splitTextToSize(
        `Return Policy: ${returnPolicy}`,
        pageWidth - margin * 2,
      );
      doc.text(policyLines, margin, y);
      y += policyLines.length * 4.5;
    }

    const thanksLines = doc.splitTextToSize(thankYou, pageWidth - margin * 2);
    doc.text(thanksLines, margin, y);
    y += thanksLines.length * 4.5;

    const contactLine = [
      storeEmail ? `Email: ${storeEmail}` : "",
      storePhone ? `Phone: ${storePhone}` : "",
    ]
      .filter(Boolean)
      .join("  •  ");
    if (contactLine) {
      doc.text(contactLine, margin, y);
      y += 4.5;
    }

    return doc.output("blob");
  } catch (err) {
    console.error("Professional PDF Creation Failed:", err);
    throw err;
  }
};

export const downloadReceiptPDF = (
  blob: Blob,
  transactionId: string,
  isAuto = false,
) => {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SellSync-Receipt-${transactionId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);

    if (isAuto) {
      toast.success("Receipt downloaded automatically", {
        description: `Order ${transactionId} saved to your device.`,
      });
    } else {
      toast.success("Receipt generated successfully");
    }
  } catch (err) {
    console.error("PDF Download Failed:", err);
    toast.error("Could not download receipt");
  }
};
