export function printReceipt(receiptText, title = 'Talão FlashStore') {
  if (!receiptText) return;

  const width = 420;
  const height = 700;
  const left = Math.round((window.screen.width - width) / 2);
  const top = Math.round((window.screen.height - height) / 2);

  const popup = window.open('', '_blank', `width=${width},height=${height},left=${left},top=${top}`);
  if (!popup) return;

  const escaped = receiptText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page { size: 80mm auto; margin: 5mm; }
          body {
            margin: 0;
            padding: 12px;
            background: #fff;
            color: #111;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
            font-size: 11px;
            line-height: 1.35;
            display: flex;
            justify-content: center;
          }
          pre {
            margin: 0;
            width: 100%;
            max-width: 72mm;
            white-space: pre-wrap;
            word-break: break-word;
          }
        </style>
      </head>
      <body>
        <pre>${escaped}</pre>
        <script>
          window.onload = () => {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  popup.document.close();
}
