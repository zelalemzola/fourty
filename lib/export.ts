import ExcelJS from "exceljs";

export async function exportToExcel<T extends Record<string, unknown>>(
  rows: T[],
  filename: string,
  sheetName = "Sheet1"
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fourty";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);
  if (!rows.length) {
    sheet.addRow(["No data"]);
  } else {
    const keys = Object.keys(rows[0]);
    sheet.columns = keys.map((key) => ({
      header: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      key,
      width: Math.max(12, key.length + 4),
    }));
    rows.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1B4332" },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
