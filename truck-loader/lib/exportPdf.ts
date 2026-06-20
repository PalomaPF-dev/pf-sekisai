/**
 * 積載計画のPDF出力（ドライバー渡し用）。
 * - Web: PDFをダウンロード（ブラウザの印刷/保存に流用可）
 * - ネイティブ(iOS): PDFをキャッシュに保存し、iOSの共有シート（印刷・ファイル保存・AirDrop・メール）で渡す
 *
 * html2pdf.js（html2canvas + jsPDF）で描画済みDOMをA4 PDF化（オフライン動作・日本語OK）。
 */
import { Capacitor } from '@capacitor/core';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? ''); // "data:application/pdf;base64,XXXX" の XXXX
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** ファイル名から OS で使えない文字（特にパス区切りの / \）を除去 */
function safeFileName(name: string): string {
  const base = name
    .replace(/\.pdf$/i, '')
    .replace(/[\/\\:*?"<>|（）\s〜~]/g, '_') // スラッシュ等→_（Filesystemでサブフォルダ扱いを防ぐ）
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return `${base || 'loading_plan'}.pdf`;
}

export async function exportLoadingPlanPdf(el: HTMLElement, filename: string): Promise<void> {
  const html2pdf = (await import('html2pdf.js')).default;
  const fname = safeFileName(filename);
  const opt = {
    margin: [8, 8, 10, 8] as [number, number, number, number],
    filename: fname,
    image: { type: 'jpeg' as const, quality: 0.95 },
    html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true },
    jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
    pagebreak: { mode: ['css', 'legacy'] },
  };

  if (Capacitor.isNativePlatform()) {
    // PDF を Blob 化 → base64 → キャッシュ保存 → 共有シート
    const pdf = await html2pdf().set(opt).from(el).toPdf().get('pdf');
    const blob: Blob = pdf.output('blob');
    const base64 = await blobToBase64(blob);

    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const written = await Filesystem.writeFile({ path: fname, data: base64, directory: Directory.Cache });
    await Share.share({
      title: fname,
      files: [written.uri],
      dialogTitle: 'ドライバーへ渡す（印刷・保存・送信）',
    });
  } else {
    // Web: ダウンロード
    await html2pdf().set(opt).from(el).save();
  }
}
