package com.example.employee.controller;

import com.example.employee.dto.ApiResponse;
import com.example.employee.dto.EmployeeRequestDto;
import com.example.employee.dto.EmployeeResponseDto;
import com.example.employee.service.EmployeeService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/employees")
@CrossOrigin(origins = "*") // Allows calls from frontend running on any host/port
public class EmployeeController {

    private final EmployeeService employeeService;

    @Autowired
    public EmployeeController(EmployeeService employeeService) {
        this.employeeService = employeeService;
    }

    /**
     * Create a new employee
     * POST /api/employees
     */
    @PostMapping
    public ResponseEntity<EmployeeResponseDto> createEmployee(@Valid @RequestBody EmployeeRequestDto dto) {
        EmployeeResponseDto created = employeeService.createEmployee(dto);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    /**
     * Get all employees, with optional department and status query params
     * GET /api/employees?department=IT&status=Active
     */
    @GetMapping
    public ResponseEntity<List<EmployeeResponseDto>> getAllEmployees(
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String status) {

        if ((department != null && !department.isBlank()) || (status != null && !status.isBlank())) {
            List<EmployeeResponseDto> filtered = employeeService.filterEmployees(department, status);
            return ResponseEntity.ok(filtered);
        }
        List<EmployeeResponseDto> employees = employeeService.getAllEmployees();
        return ResponseEntity.ok(employees);
    }

    /**
     * Get employee by ID
     * GET /api/employees/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<EmployeeResponseDto> getEmployeeById(@PathVariable Long id) {
        EmployeeResponseDto employee = employeeService.getEmployeeById(id);
        return ResponseEntity.ok(employee);
    }

    /**
     * Update an existing employee
     * PUT /api/employees/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<EmployeeResponseDto> updateEmployee(
            @PathVariable Long id,
            @Valid @RequestBody EmployeeRequestDto dto) {
        EmployeeResponseDto updated = employeeService.updateEmployee(id, dto);
        return ResponseEntity.ok(updated);
    }

    /**
     * Delete an employee
     * DELETE /api/employees/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<String>> deleteEmployee(@PathVariable Long id) {
        employeeService.deleteEmployee(id);
        return ResponseEntity.ok(ApiResponse.success("Employee with ID " + id + " was successfully deleted."));
    }

    /**
     * Search employees by name or email
     * GET /api/employees/search?name=Rahul
     * GET /api/employees/search?query=Rahul
     */
    @GetMapping("/search")
    public ResponseEntity<List<EmployeeResponseDto>> searchEmployees(
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "query", required = false) String query) {

        String searchTerm = (query != null && !query.isBlank()) ? query : name;
        List<EmployeeResponseDto> results = employeeService.searchEmployees(searchTerm);
        return ResponseEntity.ok(results);
    }

    /**
     * Filter employees by department
     * GET /api/employees/department/{department}
     */
    @GetMapping("/department/{department}")
    public ResponseEntity<List<EmployeeResponseDto>> filterByDepartment(@PathVariable String department) {
        List<EmployeeResponseDto> results = employeeService.filterEmployeesByDepartment(department);
        return ResponseEntity.ok(results);
    }

    /**
     * Filter employees by status
     * GET /api/employees/status/{status}
     */
    @GetMapping("/status/{status}")
    public ResponseEntity<List<EmployeeResponseDto>> filterByStatus(@PathVariable String status) {
        List<EmployeeResponseDto> results = employeeService.filterEmployeesByStatus(status);
        return ResponseEntity.ok(results);
    }

    /**
     * Download official PDF salary slip
     * GET /api/employees/{id}/salary-slip?month=11&year=2026
     */
    @GetMapping("/{id}/salary-slip")
    public ResponseEntity<byte[]> downloadSalarySlip(
            @PathVariable Long id,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year) {

        byte[] pdfBytes = employeeService.generateSalarySlip(id, month, year);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "Payslip_Employee_" + id + ".pdf");
        headers.setContentLength(pdfBytes.length);

        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }

    /**
     * Quick statistics for dashboard counters and analytics charts
     * GET /api/employees/stats
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        List<EmployeeResponseDto> all = employeeService.getAllEmployees();
        long total = all.size();
        long active = all.stream().filter(e -> "Active".equalsIgnoreCase(e.getStatus())).count();
        long inactive = total - active;

        // Group headcount and total salary by department
        Map<String, Long> departmentCounts = new HashMap<>();
        Map<String, Double> departmentSalaries = new HashMap<>();
        double totalPayroll = 0.0;

        for (EmployeeResponseDto emp : all) {
            String dept = (emp.getDepartment() != null && !emp.getDepartment().isBlank()) ? emp.getDepartment() : "General";
            departmentCounts.put(dept, departmentCounts.getOrDefault(dept, 0L) + 1);

            double salary = emp.getSalary() != null ? emp.getSalary().doubleValue() : 0.0;
            departmentSalaries.put(dept, departmentSalaries.getOrDefault(dept, 0.0) + salary);
            totalPayroll += salary;
        }

        double averageSalary = total > 0 ? (totalPayroll / total) : 0.0;

        Map<String, Object> stats = new HashMap<>();
        stats.put("total", total);
        stats.put("active", active);
        stats.put("inactive", inactive);
        stats.put("departmentsCount", departmentCounts.size());
        stats.put("departmentCounts", departmentCounts);
        stats.put("departmentSalaries", departmentSalaries);
        stats.put("totalPayroll", totalPayroll);
        stats.put("averageSalary", averageSalary);

        return ResponseEntity.ok(stats);
    }
}
