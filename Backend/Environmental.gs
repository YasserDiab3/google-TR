/**
 * Google Apps Script for HSE System - Environmental Module
 * 
 * موديول البيئة
 */

/**
 * إضافة جانب بيئي
 */
function addEnvironmentalAspectToSheet(aspectData) {
    const sheetName = 'EnvironmentalAspects';
    return appendToSheet(sheetName, aspectData);
}

/**
 * إضافة مراقبة بيئية
 */
function addEnvironmentalMonitoringToSheet(monitoringData) {
    const sheetName = 'EnvironmentalMonitoring';
    return appendToSheet(sheetName, monitoringData);
}

/**
 * إضافة برنامج استدامة
 */
function addSustainabilityToSheet(sustainabilityData) {
    const sheetName = 'Sustainability';
    return appendToSheet(sheetName, sustainabilityData);
}

/**
 * إضافة بصمة كربونية
 */
function addCarbonFootprintToSheet(footprintData) {
    const sheetName = 'CarbonFootprint';
    return appendToSheet(sheetName, footprintData);
}

/**
 * إضافة إدارة النفايات
 */
function addWasteManagementToSheet(wasteData) {
    const sheetName = 'WasteManagement';
    return appendToSheet(sheetName, wasteData);
}

/**
 * إضافة كفاءة الطاقة
 */
function addEnergyEfficiencyToSheet(energyData) {
    const sheetName = 'EnergyEfficiency';
    return appendToSheet(sheetName, energyData);
}

/**
 * إضافة إدارة المياه
 */
function addWaterManagementToSheet(waterData) {
    const sheetName = 'WaterManagement';
    return appendToSheet(sheetName, waterData);
}

/**
 * إضافة برنامج إعادة التدوير
 */
function addRecyclingProgramToSheet(programData) {
    const sheetName = 'RecyclingPrograms';
    return appendToSheet(sheetName, programData);
}

