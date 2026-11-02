package com.example.employee.service;

import com.example.employee.entity.Employee;
import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
public class SalarySlipPdfService {

    public byte[] generateSalarySlip(Employee emp, int month, int year) {
        Document document = new Document(PageSize.A4, 36, 36, 40, 40);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            // Styling palette
            Color primaryColor = new Color(79, 70, 229);
            Color darkTextColor = new Color(15, 23, 42);
            Color mutedTextColor = new Color(100, 116, 139);
            Color lightBgColor = new Color(248, 250, 252);
            Color borderColor = new Color(226, 232, 240);

            Font brandFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, primaryColor);
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, darkTextColor);
            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, darkTextColor);
            Font regularFont = FontFactory.getFont(FontFactory.HELVETICA, 10, darkTextColor);
            Font mutedFont = FontFactory.getFont(FontFactory.HELVETICA, 9, mutedTextColor);
            Font boldValueFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, darkTextColor);

            // Header Section
            Paragraph brandPara = new Paragraph("EMS PRO ENTERPRISE", brandFont);
            brandPara.setAlignment(Element.ALIGN_CENTER);
            document.add(brandPara);

            Paragraph subHeader = new Paragraph("Employee Database & Payroll Services", mutedFont);
            subHeader.setAlignment(Element.ALIGN_CENTER);
            document.add(subHeader);

            String monthName = LocalDate.of(year, month, 1).format(DateTimeFormatter.ofPattern("MMMM yyyy"));
            Paragraph payPeriod = new Paragraph("CONFIDENTIAL SALARY PAYSLIP - " + monthName.toUpperCase(), titleFont);
            payPeriod.setAlignment(Element.ALIGN_CENTER);
            payPeriod.setSpacingBefore(12);
            payPeriod.setSpacingAfter(15);
            document.add(payPeriod);

            // Employee Information Table
            PdfPTable empTable = new PdfPTable(4);
            empTable.setWidthPercentage(100);
            empTable.setWidths(new float[]{22, 28, 22, 28});

            addTableCell(empTable, "Employee ID:", headerFont, lightBgColor, borderColor);
            addTableCell(empTable, "#" + emp.getId(), regularFont, Color.WHITE, borderColor);
            addTableCell(empTable, "Employee Name:", headerFont, lightBgColor, borderColor);
            addTableCell(empTable, emp.getFirstName() + " " + emp.getLastName(), regularFont, Color.WHITE, borderColor);

            addTableCell(empTable, "Department:", headerFont, lightBgColor, borderColor);
            addTableCell(empTable, emp.getDepartment() != null ? emp.getDepartment() : "General", regularFont, Color.WHITE, borderColor);
            addTableCell(empTable, "Designation:", headerFont, lightBgColor, borderColor);
            addTableCell(empTable, emp.getDesignation() != null ? emp.getDesignation() : "Staff", regularFont, Color.WHITE, borderColor);

            addTableCell(empTable, "Email Address:", headerFont, lightBgColor, borderColor);
            addTableCell(empTable, emp.getEmail(), regularFont, Color.WHITE, borderColor);
            addTableCell(empTable, "Joining Date:", headerFont, lightBgColor, borderColor);
            addTableCell(empTable, emp.getJoiningDate() != null ? emp.getJoiningDate().toString() : "N/A", regularFont, Color.WHITE, borderColor);

            empTable.setSpacingAfter(20);
            document.add(empTable);

            // Calculations based on Monthly Salary
            BigDecimal basic = emp.getSalary() != null ? emp.getSalary() : BigDecimal.ZERO;
            BigDecimal hra = basic.multiply(new BigDecimal("0.40")); // 40% HRA
            BigDecimal da = basic.multiply(new BigDecimal("0.10"));  // 10% Dearness Allowance
            BigDecimal special = basic.multiply(new BigDecimal("0.15")); // 15% Special Allowance
            BigDecimal grossEarnings = basic.add(hra).add(da).add(special);

            BigDecimal pf = basic.multiply(new BigDecimal("0.12")); // 12% PF Deduction
            BigDecimal tax = grossEarnings.multiply(new BigDecimal("0.05")); // 5% TDS / Professional Tax
            BigDecimal totalDeductions = pf.add(tax);

            BigDecimal netSalary = grossEarnings.subtract(totalDeductions);

            NumberFormat inrFormat = NumberFormat.getCurrencyInstance(new Locale("en", "IN"));

            // Breakdown Table (Earnings vs Deductions)
            PdfPTable breakdownTable = new PdfPTable(4);
            breakdownTable.setWidthPercentage(100);
            breakdownTable.setWidths(new float[]{30, 20, 30, 20});

            // Header Row
            addTableCell(breakdownTable, "EARNINGS", headerFont, lightBgColor, borderColor);
            addTableCell(breakdownTable, "AMOUNT", headerFont, lightBgColor, borderColor);
            addTableCell(breakdownTable, "DEDUCTIONS", headerFont, lightBgColor, borderColor);
            addTableCell(breakdownTable, "AMOUNT", headerFont, lightBgColor, borderColor);

            // Row 1
            addTableCell(breakdownTable, "Basic Salary", regularFont, Color.WHITE, borderColor);
            addTableCell(breakdownTable, inrFormat.format(basic), regularFont, Color.WHITE, borderColor);
            addTableCell(breakdownTable, "Provident Fund (PF 12%)", regularFont, Color.WHITE, borderColor);
            addTableCell(breakdownTable, inrFormat.format(pf), regularFont, Color.WHITE, borderColor);

            // Row 2
            addTableCell(breakdownTable, "House Rent Allowance (HRA)", regularFont, Color.WHITE, borderColor);
            addTableCell(breakdownTable, inrFormat.format(hra), regularFont, Color.WHITE, borderColor);
            addTableCell(breakdownTable, "Professional Tax & TDS", regularFont, Color.WHITE, borderColor);
            addTableCell(breakdownTable, inrFormat.format(tax), regularFont, Color.WHITE, borderColor);

            // Row 3
            addTableCell(breakdownTable, "Dearness Allowance (DA)", regularFont, Color.WHITE, borderColor);
            addTableCell(breakdownTable, inrFormat.format(da), regularFont, Color.WHITE, borderColor);
            addTableCell(breakdownTable, "--", regularFont, Color.WHITE, borderColor);
            addTableCell(breakdownTable, "--", regularFont, Color.WHITE, borderColor);

            // Row 4
            addTableCell(breakdownTable, "Special Allowance", regularFont, Color.WHITE, borderColor);
            addTableCell(breakdownTable, inrFormat.format(special), regularFont, Color.WHITE, borderColor);
            addTableCell(breakdownTable, "--", regularFont, Color.WHITE, borderColor);
            addTableCell(breakdownTable, "--", regularFont, Color.WHITE, borderColor);

            // Subtotals
            addTableCell(breakdownTable, "TOTAL GROSS EARNINGS", headerFont, lightBgColor, borderColor);
            addTableCell(breakdownTable, inrFormat.format(grossEarnings), boldValueFont, lightBgColor, borderColor);
            addTableCell(breakdownTable, "TOTAL DEDUCTIONS", headerFont, lightBgColor, borderColor);
            addTableCell(breakdownTable, inrFormat.format(totalDeductions), boldValueFont, lightBgColor, borderColor);

            breakdownTable.setSpacingAfter(20);
            document.add(breakdownTable);

            // Net Payable Box
            PdfPTable netTable = new PdfPTable(1);
            netTable.setWidthPercentage(100);
            PdfPCell netCell = new PdfPCell();
            netCell.setBackgroundColor(new Color(238, 242, 255));
            netCell.setBorderColor(primaryColor);
            netCell.setPadding(12);

            Paragraph netTitle = new Paragraph("NET SALARY PAYABLE", headerFont);
            netTitle.setAlignment(Element.ALIGN_CENTER);
            netCell.addElement(netTitle);

            Font bigNetFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, primaryColor);
            Paragraph netAmount = new Paragraph(inrFormat.format(netSalary), bigNetFont);
            netAmount.setAlignment(Element.ALIGN_CENTER);
            netCell.addElement(netAmount);

            netTable.addCell(netCell);
            netTable.setSpacingAfter(25);
            document.add(netTable);

            // Signatures & Legal Disclaimer
            Paragraph notice = new Paragraph("This is a computer-generated payslip and does not require a physical signature.", mutedFont);
            notice.setAlignment(Element.ALIGN_CENTER);
            document.add(notice);

            document.close();
        } catch (Exception ex) {
            throw new RuntimeException("Error generating salary slip PDF: " + ex.getMessage(), ex);
        }

        return out.toByteArray();
    }

    private void addTableCell(PdfPTable table, String text, Font font, Color bgColor, Color borderColor) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBackgroundColor(bgColor);
        cell.setBorderColor(borderColor);
        cell.setPadding(6);
        cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        table.addCell(cell);
    }
}

