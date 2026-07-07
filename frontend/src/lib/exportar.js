// Export client-side, sem dependência extra: CSV abre direto no Excel/Sheets
// (evita adicionar uma lib pesada tipo SheetJS só pra isso). "Exportar PDF"
// usa a própria caixa de impressão do navegador (o usuário escolhe "Salvar
// como PDF" no destino) sobre uma view formatada pra impressão.

function paraCsvValue(v) {
  const s = v === null || v === undefined ? "" : String(v)
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function exportarCsv(nomeArquivo, linhas) {
  if (!linhas.length) return
  const colunas = Object.keys(linhas[0])
  const corpo = [colunas.join(","), ...linhas.map((l) => colunas.map((c) => paraCsvValue(l[c])).join(","))].join(
    "\n"
  )
  // BOM pra acentuação abrir certo no Excel.
  const blob = new Blob(["﻿" + corpo], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(url)
}

export function exportarPdfViaImpressao(titulo, htmlConteudo) {
  const janela = window.open("", "_blank")
  if (!janela) return
  janela.document.write(`
    <html>
      <head>
        <title>${titulo}</title>
        <style>
          body { font-family: -apple-system, Arial, sans-serif; color: #0A0E12; padding: 24px; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #ddd; font-size: 12.5px; }
          th { color: #666; text-transform: uppercase; font-size: 10.5px; }
          .right { text-align: right; }
        </style>
      </head>
      <body>
        <h1>${titulo}</h1>
        ${htmlConteudo}
      </body>
    </html>
  `)
  janela.document.close()
  janela.focus()
  setTimeout(() => janela.print(), 300)
}
