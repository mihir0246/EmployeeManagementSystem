package com.example.employee.service;

import com.example.employee.dto.EmployeeRequestDto;
import com.example.employee.dto.EmployeeResponseDto;

import java.util.List;

public interface EmployeeService {

    EmployeeResponseDto createEmployee(EmployeeRequestDto dto);

    List<EmployeeResponseDto> getAllEmployees();

    EmployeeResponseDto getEmployeeById(Long id);

    EmployeeResponseDto updateEmployee(Long id, EmployeeRequestDto dto);

    void deleteEmployee(Long id);

    List<EmployeeResponseDto> searchEmployees(String query);

    List<EmployeeResponseDto> filterEmployeesByDepartment(String department);

    List<EmployeeResponseDto> filterEmployeesByStatus(String status);

    List<EmployeeResponseDto> filterEmployees(String department, String status);

    byte[] generateSalarySlip(Long id, Integer month, Integer year);
}
