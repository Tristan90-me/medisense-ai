import jsPDF from 'jspdf';
// html2canvas-pro, not html2canvas — the original doesn't parse the
// oklch()-based color functions Tailwind v4 emits for every utility class,
// so it throws on this app's real markup (confirmed while building this).
import html2canvas from 'html2canvas-pro';

// Renders a DOM node to a multi-page A4 PDF and triggers a browser download.
// Used for the printable report components (PrintableSession,
// PrintableSummary) that already exist for the "Print" button — this is a
// separate, direct-to-file export rather than going through the OS print
// dialog, which `react-to-print` already covers.
//
// `element` must have real layout (non-zero dimensions) at capture time —
// html2canvas can't render a `display:none` subtree. Callers keep their
// printable node positioned off-screen (not hidden) for this reason.
export async function downloadElementAsPdf(element, filename) {
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
  // JPEG, not PNG — this is a flat white-background text report with no
  // transparency to preserve, and PNG was producing multi-megabyte files
  // (confirmed: ~7.7MB) for what should be a lightweight download. JPEG at
  // this quality is visually indistinguishable here and roughly an order
  // of magnitude smaller.
  const imgData = canvas.toDataURL('image/jpeg', 0.92);

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}
