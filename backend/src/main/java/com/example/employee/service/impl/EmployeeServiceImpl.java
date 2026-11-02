package com.example.employee.service.impl;

import com.example.employee.dto.EmployeeRequestDto;
import com.example.employee.dto.EmployeeResponseDto;
import com.example.employee.entity.Employee;
import com.example.employee.exception.DuplicateEmailException;
import com.example.employee.exception.EmployeeNotFoundException;
import com.example.employee.repository.EmployeeRepository;
import com.example.employee.service.EmployeeService;
import com.example.employee.service.SalarySlipPdfService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class EmployeeServiceImpl implements EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final SalarySlipPdfService salarySlipPdfService;

    @Autowired
    public EmployeeServiceImpl(EmployeeRepository employeeRepository, SalarySlipPdfService salarySlipPdfService) {
        this.employeeRepository = employeeRepository;
        this.salarySlipPdfService = salarySlipPdfService;
    }

    @Override
    public EmployeeResponseDto createEmployee(EmployeeRequestDto dto) {
        // Business Rule: Check for unique email
        if (employeeRepository.existsByEmail(dto.getEmail())) {
            throw new DuplicateEmailException("An employee with email '" + dto.getEmail() + "' already exists.");
        }

        Employee employee = new Employee();
        mapDtoToEntity(dto, employee);

        Employee saved = employeeRepository.save(employee);
        return EmployeeResponseDto.fromEntity(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<EmployeeResponseDto> getAllEmployees() {
        return employeeRepository.findAll().stream()
                .map(EmployeeResponseDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public EmployeeResponseDto getEmployeeById(Long id) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new EmployeeNotFoundException(id));
        return EmployeeResponseDto.fromEntity(employee);
    }

    @Override
    public EmployeeResponseDto updateEmployee(Long id, EmployeeRequestDto dto) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new EmployeeNotFoundException(id));

        // Business Rule: Ensure email uniqueness across other employees
        if (employeeRepository.existsByEmailAndIdNot(dto.getEmail(), id)) {
            throw new DuplicateEmailException("Another employee with email '" + dto.getEmail() + "' already exists.");
        }

        mapDtoToEntity(dto, employee);
        Employee updated = employeeRepository.save(employee);
        return EmployeeResponseDto.fromEntity(updated);
    }

    @Override
    public void deleteEmployee(Long id) {
        if (!employeeRepository.existsById(id)) {
            throw new EmployeeNotFoundException(id);
        }
        employeeRepository.deleteById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<EmployeeResponseDto> searchEmployees(String query) {
        if (query == null || query.trim().isEmpty()) {
            return getAllEmployees();
        }
        return employeeRepository.searchEmployees(query.trim()).stream()
                .map(EmployeeResponseDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<EmployeeResponseDto> filterEmployeesByDepartment(String department) {
        if (department == null || department.equalsIgnoreCase("ALL") || department.trim().isEmpty()) {
            return getAllEmployees();
        }
        return employeeRepository.findByDepartmentIgnoreCase(department.trim()).stream()
                .map(EmployeeResponseDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<EmployeeResponseDto> filterEmployeesByStatus(String status) {
        if (status == null || status.equalsIgnoreCase("ALL") || status.trim().isEmpty()) {
            return getAllEmployees();
        }
        return employeeRepository.findByStatusIgnoreCase(status.trim()).stream()
                .map(EmployeeResponseDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<EmployeeResponseDto> filterEmployees(String department, String status) {
        boolean hasDept = department != null && !department.equalsIgnoreCase("ALL") && !department.trim().isEmpty();
        boolean hasStatus = status != null && !status.equalsIgnoreCase("ALL") && !status.trim().isEmpty();

        List<Employee> result;
        if (hasDept && hasStatus) {
            result = employeeRepository.findByDepartmentIgnoreCaseAndStatusIgnoreCase(department.trim(), status.trim());
        } else if (hasDept) {
            result = employeeRepository.findByDepartmentIgnoreCase(department.trim());
        } else if (hasStatus) {
            result = employeeRepository.findByStatusIgnoreCase(status.trim());
        } else {
            result = employeeRepository.findAll();
        }

        return result.stream()
                .map(EmployeeResponseDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] generateSalarySlip(Long id, Integer month, Integer year) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new EmployeeNotFoundException(id));

        LocalDate now = LocalDate.now();
        int targetMonth = (month != null && month >= 1 && month <= 12) ? month : now.getMonthValue();
        int targetYear = (year != null && year >= 2000 && year <= 2100) ? year : now.getYear();

        return salarySlipPdfService.generateSalarySlip(employee, targetMonth, targetYear);
    }

    private void mapDtoToEntity(EmployeeRequestDto dto, Employee employee) {
        employee.setFirstName(dto.getFirstName().trim());
        employee.setLastName(dto.getLastName().trim());
        employee.setEmail(dto.getEmail().trim().toLowerCase());
        employee.setPhone(dto.getPhone() != null ? dto.getPhone().trim() : null);
        employee.setDateOfBirth(dto.getDateOfBirth());
        employee.setGender(dto.getGender());
        employee.setDepartment(dto.getDepartment().trim());
        employee.setDesignation(dto.getDesignation() != null ? dto.getDesignation().trim() : null);
        employee.setSalary(dto.getSalary());
        employee.setJoiningDate(dto.getJoiningDate());
        employee.setAddress(dto.getAddress() != null ? dto.getAddress().trim() : null);
        employee.setStatus(dto.getStatus() != null ? dto.getStatus().trim() : "Active");
    }
}
