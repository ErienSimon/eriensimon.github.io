// Global variables
let allData = [];
let activeZoneId = null;
let ZONES = []; // Will be populated dynamically
let currentTrendTimeWindow = '1M'; // Default time window
let currentTrendMetric = 'Electricity'; // Default for the SELECTABLE metric (Electricity, Cost, Carbon)
let globalLatestTimestamp = null; // To store the latest date from the entire dataset

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if the dashboard container exists before initializing
    if (document.querySelector('.dashboard-container')) {
        initDashboard();
    }
});

/**
 * Initializes the dashboard: loads data and renders components.
 */
async function initDashboard() {
    try {
        const rawData = await d3.csv('samba_data.csv'); 
        allData = processData(rawData);
        
        // Determine the latest timestamp from the entire dataset safely
        if (allData.length > 0) {
            const latestTime = allData.reduce((max, d) => d.timestamp > max ? d.timestamp : max, allData[0].timestamp);
            globalLatestTimestamp = new Date(latestTime);
        } else {
             console.error("No data processed, cannot determine a global latest timestamp.");
        }
        
        const uniqueZoneIds = [...new Set(allData.map(d => String(d.zone_id).trim()))] 
                              .filter(id => id.length > 0) 
                              .sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
        
        if (uniqueZoneIds.length > 0) {
            ZONES = uniqueZoneIds;
            activeZoneId = ZONES[0]; 
        } else {
            console.error("No valid zones found in the data. Cannot initialize dashboard.");
            document.getElementById('historicalTrendsChart').innerHTML = "<p>Error: No zones found in data.</p>";
            const zoneGrid = document.getElementById('zoneGrid');
            if(zoneGrid) zoneGrid.innerHTML = "<p>Error: No zones found in data to display in overview.</p>";
            return; 
        }

        renderBuildingOverview(); 
        renderDashboard(activeZoneId); 
        setupEventListeners();

    } catch (error) {
        console.error("Error initializing dashboard:", error);
        document.getElementById('historicalTrendsChart').innerHTML = `<p>Fatal Error: Could not initialize dashboard. ${error.message}</p>`;
    }
}


/**
 * Helper function to format numbers for KPI cards.
 */
function formatKpiValue(num, unit, isCurrency = false) {
    const currencySymbol = 'AUD';
    if (typeof num !== 'number' || isNaN(num)) {
        return isCurrency ? `-- ${currencySymbol}` : `-- ${unit}`;
    }
    let valueStr, numAbs = Math.abs(num), decimals;
    if (numAbs >= 1.0e+6) { 
        decimals = isCurrency ? (numAbs % 1.0e+6 === 0 ? 0 : 2) : (numAbs % 1.0e+6 === 0 ? 0 : 1) ; 
        valueStr = (num / 1.0e+6).toFixed(decimals) + 'M';
    } else if (numAbs >= 1.0e+3 ) { 
        if (isCurrency) { decimals = (numAbs % 1000 === 0 ? 0 : 1); } 
        else { decimals = (numAbs % 1000 === 0 ? 0 : 1); }
        valueStr = (num / 1.0e+3).toFixed(decimals) + 'k';
    } else { 
        if (isCurrency) { decimals = (numAbs % 1 === 0) ? 0 : 2; } 
        else { decimals = (numAbs % 1 === 0) ? 0 : 1; }
        valueStr = num.toFixed(decimals);
    }
    return isCurrency ? (isCurrency && currencySymbol === 'AUD' ? `$${valueStr}` : `${valueStr} ${currencySymbol}`) : `${valueStr} ${unit}`;
}

/**
 * Processes raw data from CSV and adds alert logic.
 */
function processData(rawData) {
    return rawData.map((d, index) => {
        const originalZoneId = d.zone_id; 
        const originalTimestampStr = d.created_at; 

        const zone_id_as_string = originalZoneId ? String(originalZoneId).replace(/^\s+|\s+$/g, '') : ""; 
        
        const toNumber = (val) => { const num = parseFloat(val); return isNaN(num) ? undefined : num; };
        
        const co2_val = toNumber(d.co2);
        const kwh_val = toNumber(d.Electricity); 
        const cost_val = toNumber(d.Cost); 
        const carbon_kg_val = toNumber(d['CO? emissions']); 

        let ahu_fan_speed, fresh_air_damper, occupancy;
        const timestampObj = new Date(originalTimestampStr); 

        if (typeof co2_val !== 'undefined') { 
            if (co2_val <= 600) { ahu_fan_speed = 30; fresh_air_damper = 20; occupancy = "Low / Unoccupied"; } 
            else if (co2_val <= 1000) { ahu_fan_speed = 55; fresh_air_damper = 40; occupancy = "Moderate"; } 
            else { ahu_fan_speed = 75; fresh_air_damper = 60; occupancy = "High"; }
        } else { ahu_fan_speed = undefined; fresh_air_damper = undefined; occupancy = 'N/A'; }

        let alert_flag_for_row = false;
        let alert_message_for_row = "";

        if (zone_id_as_string === '431' && co2_val > 1000 && ahu_fan_speed < 75) {
            alert_flag_for_row = true;
            alert_message_for_row = `High CO2 & underventilation detected.`;
        }
        else if (co2_val > 1200) {
            alert_flag_for_row = true;
            alert_message_for_row = `High CO2 Level (${co2_val.toFixed(0)} ppm).`;
        }
        else if (occupancy === "High" && ahu_fan_speed < 75) {
            alert_flag_for_row = true;
            alert_message_for_row = `Potential underventilation.`;
        }
        
        const processedRow = {
            timestamp: timestampObj, 
            zone_id: zone_id_as_string, 
            co2_ppm: co2_val,
            electricity_kwh: kwh_val, 
            cost_aud: cost_val,
            carbon_emissions_kg: carbon_kg_val,
            ahu_fan_speed_percent: ahu_fan_speed, 
            fresh_air_damper_percent: fresh_air_damper,
            occupancy_status: occupancy, 
            alert_flag: alert_flag_for_row, 
            alert_message: alert_message_for_row,
            floor_level: d.floor_level, 
            date_str: d.date, 
            time_str: d.time, 
            hour: toNumber(d.hour),
            day_of_week: d['Day of Week'], 
            month_str: d.Month
        };
        
        return processedRow;

    }).filter((processed_d) => {
        const isTimestampValid = processed_d.timestamp instanceof Date && !isNaN(processed_d.timestamp);
        const isZoneIdTruthy = !!processed_d.zone_id && processed_d.zone_id.length > 0; 
        return isTimestampValid && isZoneIdTruthy; 
    }); 
}

/**
 * Main function to update all dashboard widgets.
 */
function renderDashboard(zoneId) {
    activeZoneId = zoneId;
    document.querySelectorAll('.zone-tile').forEach(tile => {
        tile.classList.remove('active-zone');
        if (tile.dataset.zoneId === activeZoneId) tile.classList.add('active-zone');
    });

    const zoneData = allData.filter(d => d.zone_id === activeZoneId);
    const latestZoneDataPoint = getLatestDataPoint(zoneData);
    
    renderHistoricalTrends(zoneData, currentTrendTimeWindow);
    // Correctly use the latest data point from the SPECIFIC zone for KPI calculation
    renderKpiCards(zoneData, latestZoneDataPoint ? latestZoneDataPoint.timestamp : null);
    
    const airQualityWidgetTitle = document.querySelector('.air-quality-widget .widget-title');
    if(airQualityWidgetTitle) airQualityWidgetTitle.textContent = `Air Quality (Zone ${activeZoneId || 'N/A'})`;
    renderAirQualityGauge(latestZoneDataPoint); 

    renderOccupancyWidget(latestZoneDataPoint); 
        
    renderVentilationLog(zoneData); 
    renderAlerts(); 
    
    renderSystemSnapshotMiniCards(latestZoneDataPoint); 
    
    const systemSnapshotTitle = document.querySelector('.system-snapshot-widget .widget-title');
    if(systemSnapshotTitle) systemSnapshotTitle.textContent = `System Status Details (Zone ${activeZoneId || 'N/A'})`;
}

/**
 * Sets up event listeners.
 */
function setupEventListeners() {
    const zoneGrid = document.getElementById('zoneGrid');
    if (zoneGrid) {
        zoneGrid.addEventListener('click', (event) => {
            const tile = event.target.closest('.zone-tile');
            if (tile && tile.dataset.zoneId) renderDashboard(tile.dataset.zoneId);
        });
    }
    const timeWindowButtons = document.getElementById('timeWindowButtons');
    if (timeWindowButtons) {
        timeWindowButtons.addEventListener('click', (event) => {
            if (event.target.tagName === 'BUTTON') {
                currentTrendTimeWindow = event.target.dataset.window;
                timeWindowButtons.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                event.target.classList.add('active');
                const zoneData = allData.filter(d => d.zone_id === activeZoneId); 
                renderHistoricalTrends(zoneData, currentTrendTimeWindow); 
            }
        });
    }
    const markIssueBtn = document.getElementById('markIssueButton');
    if (markIssueBtn) {
        markIssueBtn.addEventListener('click', () => {
            if (activeZoneId) {
                showToast(`Issue flagged for Zone ${activeZoneId} ventilation. Maintenance notified.`);
            } else {
                showToast("Please select a zone to mark an issue for its ventilation.");
            }
        });
    }
}

/**
 * Renders the building overview grid (heatmap).
 */
function renderBuildingOverview() {
    const zoneGrid = document.getElementById('zoneGrid');
    if (!zoneGrid) return;
    zoneGrid.innerHTML = ''; 
    if (ZONES.length === 0) { zoneGrid.innerHTML = '<p>No zones defined for overview.</p>'; return; }
    
    const zoneTypeMapping = { 
        "402": "Cafeteria", "403": "Office", "430": "Meeting Room", 
        "431": "Lab", "47": "Lobby", "48": "Office", 
        "49": "Open Workspace", "243": "Utility", 
        "50": "Storage" 
    };
    const defaultZoneType = "Zone";

    ZONES.forEach(zoneId => { 
        const tile = document.createElement('div');
        tile.classList.add('zone-tile');
        tile.dataset.zoneId = zoneId; 
        
        const zoneSpecificData = allData.filter(d => d.zone_id === zoneId); 
        const latestData = getLatestDataPoint(zoneSpecificData); 
        
        let co2 = latestData ? latestData.co2_ppm : undefined; 
        let co2Band = getCO2Band(co2);
        
        const zoneType = zoneTypeMapping[zoneId] || defaultZoneType;
        
        const zoneNameDisplay = document.createElement('div'); 
        zoneNameDisplay.classList.add('zone-tile-name');
        zoneNameDisplay.textContent = `${zoneType}`;
        
        const zoneIdDisplay = document.createElement('div'); 
        zoneIdDisplay.classList.add('zone-tile-id');
        zoneIdDisplay.textContent = `(Zone ${zoneId})`;
        
        const co2Display = document.createElement('div'); 
        co2Display.classList.add('zone-tile-co2');
        co2Display.textContent = typeof co2 !== 'undefined' ? `${co2.toFixed(0)} ppm` : 'N/A';
        
        tile.appendChild(zoneNameDisplay); 
        tile.appendChild(zoneIdDisplay); 
        tile.appendChild(co2Display); 
        
        tile.classList.add(co2Band.className); 
        if (zoneId === activeZoneId) tile.classList.add('active-zone');
        
        zoneGrid.appendChild(tile);
    });
}

/**
 * Renders the historical trends line chart with CO2 as a histogram.
 */
function renderHistoricalTrends(zoneData, timeWindow) {
    const chartDiv = document.getElementById('historicalTrendsChart');
    if (!zoneData || zoneData.length === 0) {
        chartDiv.innerHTML = "<p class='na-center'>No data available for historical trends for this zone.</p>"; 
        Plotly.purge(chartDiv); 
        return;
    }
    const { dataForChart, tickFormatXAxis, title: timeWindowTitle } = aggregateDataForTrends(zoneData, timeWindow);

    if (!dataForChart || dataForChart.timestamps.length === 0) {
        chartDiv.innerHTML = `<p class='na-center'>Not enough data for ${timeWindowTitle} window for this zone.</p>`; 
        Plotly.purge(chartDiv); 
        return;
    }
    
    const colors = {
        'CO2': 'rgba(139, 92, 246, 0.6)', // Purple for bars
        'Electricity': '#5dade2',
        'Cost': '#58d68d',
        'Carbon Emissions': '#af7ac5'
    };

    const traces = [ 
        { 
            x: dataForChart.timestamps, y: dataForChart.co2_ppm, name: 'CO₂', 
            type: 'bar', // CHANGED to 'bar' for histogram effect
            marker: { color: colors['CO2'] },
            hovertemplate: '%{y:.0f} ppm<extra></extra>',
            visible: true, 
            yaxis: 'y2' 
        },
        { 
            x: dataForChart.timestamps, y: dataForChart.electricity, name: 'Energy Use', 
            type: 'scatter', mode: 'lines+markers', 
            line: {shape: 'spline', color: colors['Electricity']}, 
            marker: { size: 5, symbol: 'circle' },
            hovertemplate: '%{y:.1s} kWh<extra></extra>',
            visible: currentTrendMetric === 'Electricity', 
            yaxis: 'y1' 
        },
        { 
            x: dataForChart.timestamps, y: dataForChart.cost, name: 'Estimated Cost', 
            type: 'scatter', mode: 'lines+markers', 
            line: {shape: 'spline', color: colors['Cost']},
            marker: { size: 5, symbol: 'circle' },
            hovertemplate: '$%{y:,.1s} AUD<extra></extra>',
            visible: currentTrendMetric === 'Cost', 
            yaxis: 'y1' 
        }, 
        { 
            x: dataForChart.timestamps, y: dataForChart.carbon, name: 'Carbon Emissions', 
            type: 'scatter', mode: 'lines+markers', 
            line: {shape: 'spline', color: colors['Carbon Emissions']}, 
            marker: { size: 5, symbol: 'circle' },
            hovertemplate: '%{y:.1s} kg<extra></extra>',
            visible: currentTrendMetric === 'Carbon Emissions', 
            yaxis: 'y1' 
        } 
    ];

    let primaryYAxisTitle = 'Value';
    if (currentTrendMetric === 'Electricity') primaryYAxisTitle = 'Energy Use (kWh)';
    else if (currentTrendMetric === 'Cost') primaryYAxisTitle = 'Estimated Cost (AUD)';
    else if (currentTrendMetric === 'Carbon Emissions') primaryYAxisTitle = 'Carbon Emissions (kg CO₂)';

    const layout = {
        title: {text: `Historical Trends (${timeWindowTitle}) - Zone ${activeZoneId}`, font: {size: 14, family: 'Segoe UI, sans-serif'}, y:0.95},
        margin: { t: 60, b: 60, l: 70, r: 70 }, 
        barmode: 'overlay', // ADDED to layer bars and lines
        xaxis: { 
            title: {text: '', font: {size: 10}}, tickfont: {size: 9, family: 'Segoe UI, sans-serif'},
            tickformat: tickFormatXAxis, 
            gridcolor: '#f0f2f5', zerolinecolor: '#d5dbdb', automargin: true
        },
        yaxis: { 
            title: {text: primaryYAxisTitle, font: {size:10, family: 'Segoe UI, sans-serif'}}, 
            tickfont: {size:9}, 
            gridcolor: '#f0f2f5', zerolinecolor: '#d5dbdb', automargin: true
        },
        yaxis2: { 
            title: {text: 'CO₂ (ppm)', font: {size:10, color: colors['CO2']}},
            tickfont: {size:9, color: colors['CO2']},
            overlaying: 'y',
            side: 'right',
            showgrid: false, 
            automargin: true
        },
        legend: { x: 0.5, y: -0.25, xanchor: 'center', orientation: 'h', font: {size: 10, family: 'Segoe UI, sans-serif'} },
        height: 340,
        hovermode: 'x unified',
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
        updatemenus: [{
            buttons: [
                {
                    args: [{'visible': [true, true, false, false]}, {'yaxis.title.text': 'Energy Use (kWh)'}], 
                    label: 'Energy Use', method: 'update'
                },
                {
                    args: [{'visible': [true, false, true, false]}, {'yaxis.title.text': 'Estimated Cost (AUD)'}], 
                    label: 'Cost', method: 'update'
                },
                {
                    args: [{'visible': [true, false, false, true]}, {'yaxis.title.text': 'Carbon Emissions (kg CO₂)'}], 
                    label: 'Carbon Emissions', method: 'update'
                }
            ],
            direction: 'down',
            pad: {'r': 10, 't': 10},
            showactive: true,
            x: 0.05, 
            xanchor: 'left',
            y: 1.18, 
            yanchor: 'top',
            font: {size: 10, family: 'Segoe UI, sans-serif'},
            bgcolor: '#e9ecef',
            bordercolor: '#dee2e6',
            active: ['Electricity', 'Cost', 'Carbon Emissions'].indexOf(currentTrendMetric)
        }]
    };
    
    chartDiv.dataset.currentMetric = currentTrendMetric; 
    Plotly.react(chartDiv, traces, layout, {responsive: true, displaylogo: false});

    chartDiv.on('plotly_restyle', (eventData) => {
        if (eventData && eventData[0] && typeof eventData[0].visible !== 'undefined') {
            const visibilityFlags = eventData[0].visible; 
            if (visibilityFlags[1]) currentTrendMetric = 'Electricity'; 
            else if (visibilityFlags[2]) currentTrendMetric = 'Cost'; 
            else if (visibilityFlags[3]) currentTrendMetric = 'Carbon Emissions'; 
            
            console.log("Trend metric changed via dropdown to:", currentTrendMetric);
            chartDiv.dataset.currentMetric = currentTrendMetric;
        }
    });
}

/**
 * Aggregates data for trends.
 */
function aggregateDataForTrends(zoneData, timeWindow) { 
    if (!zoneData || zoneData.length === 0) return { dataForChart: {timestamps: [], co2_ppm: [], electricity: [], cost: [], carbon: []}, tickFormatXAxis: '%Y-%m-%d', title: timeWindow };
    
    const validTimestamps = zoneData.map(d => d.timestamp).filter(t => t instanceof Date && !isNaN(t));
    if (validTimestamps.length === 0) return { dataForChart: {timestamps: [], co2_ppm: [], electricity: [], cost: [], carbon: []}, tickFormatXAxis: '%Y-%m-%d', title: 'Error' };
    const now = new Date(Math.max(...validTimestamps.map(t => t.getTime())));
    
    let startDate = new Date(now);
    let aggregationFormat;
    let tickFormatXAxis = '%H:%M %d %b'; 
    let title = timeWindow;

    zoneData.sort((a, b) => a.timestamp - b.timestamp); 

    switch (timeWindow) {
        case '1D': startDate.setDate(now.getDate() - 1); aggregationFormat = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}`; tickFormatXAxis = '%I:%M %p'; title = 'Last 24 Hrs'; break;
        case '1W': startDate.setDate(now.getDate() - 7); aggregationFormat = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; tickFormatXAxis = '%a, %b %d'; title = 'Last 7 Days'; break;
        case '1M': startDate.setMonth(now.getMonth() - 1); aggregationFormat = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; tickFormatXAxis = '%d %b'; title = 'Last 30 Days'; break;
        case '3M': startDate.setMonth(now.getMonth() - 3); aggregationFormat = d => { const ws = new Date(d); ws.setDate(d.getDate() - ws.getDay() + (ws.getDay() === 0 ? -6 : 1) ); return `${ws.getFullYear()}-W${String(getWeekNumber(ws)).padStart(2,'0')}`; }; tickFormatXAxis = 'W%W (%b)'; title = 'Last 3 Months'; break;
        case '1Y': startDate.setFullYear(now.getFullYear() - 1); aggregationFormat = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; tickFormatXAxis = '%b %Y'; title = 'Last Year'; break;
        default: startDate.setMonth(now.getMonth() - 1); aggregationFormat = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; tickFormatXAxis = '%d %b'; title = 'Last 30 Days';
    }

    const filteredData = zoneData.filter(d => d.timestamp >= startDate && d.timestamp <= now);
    if (filteredData.length === 0) return { dataForChart: {timestamps: [], co2_ppm: [], electricity: [], cost: [], carbon: []}, tickFormatXAxis, title };
    
    const groupedData = d3.group(filteredData, d => aggregationFormat(d.timestamp));
    const aggregated = { timestamps: [], co2_ppm: [], electricity: [], cost: [], carbon: [] }; 
    
    const sortedGroupKeys = Array.from(groupedData.keys()).sort((a,b) => {
        const dateA = new Date(a.split('-W').join('-')); 
        const dateB = new Date(b.split('-W').join('-'));
        if (!isNaN(dateA) && !isNaN(dateB)) return dateA - dateB;
        return a.localeCompare(b); 
    });

    sortedGroupKeys.forEach(key => {
        const values = groupedData.get(key);
        if (values && values.length > 0) {
            let representativeTimestamp;
            if (timeWindow === '1D') { 
                 const parts = key.split('-'); 
                 representativeTimestamp = new Date(parts[0], parseInt(parts[1])-1, parts[2], parts[3]);
            } else if (timeWindow === '1W' || timeWindow === '1M') { 
                 const parts = key.split('-'); 
                 representativeTimestamp = new Date(parts[0], parseInt(parts[1])-1, parts[2]);
            } else if (timeWindow === '3M'){ 
                representativeTimestamp = values[0].timestamp; 
            } else if (timeWindow === '1Y') { 
                 const parts = key.split('-'); 
                 representativeTimestamp = new Date(parts[0], parseInt(parts[1])-1, 1);
            } else {
                representativeTimestamp = values[0].timestamp; 
            }
            aggregated.timestamps.push(representativeTimestamp); 
            aggregated.co2_ppm.push(d3.mean(values, v => v.co2_ppm)); 
            aggregated.electricity.push(d3.mean(values, v => v.electricity_kwh));
            aggregated.cost.push(d3.mean(values, v => v.cost_aud)); 
            aggregated.carbon.push(d3.mean(values, v => v.carbon_emissions_kg));
        }
    });
    return { dataForChart: aggregated, tickFormatXAxis, title };
}


function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7)); 
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

/**
 * Renders KPI cards for the last 24 hours with color coding.
 */
function renderKpiCards(zoneData, latestTimestampForZone) {
    const kpi = { eVal:gid('kpiElectricityValue'), eChg:gid('kpiElectricityChange'), cVal:gid('kpiCostValue'), cChg:gid('kpiCostChange'), co2Val:gid('kpiCarbonValue'), co2Chg:gid('kpiCarbonChange') };
    
    const resetKpi = (valueElem, changeElem, unit, isCurrency = false) => {
        if(valueElem) {
            valueElem.textContent = formatKpiValue(NaN, unit, isCurrency);
            valueElem.className = 'kpi-value'; 
        }
        if(changeElem) {
            changeElem.textContent = '--% from yesterday';
            changeElem.className = 'change-indicator';
        }
    };

    const reset = () => { 
        resetKpi(kpi.eVal, kpi.eChg, 'kWh');
        resetKpi(kpi.cVal, kpi.cChg, 'AUD', true);
        resetKpi(kpi.co2Val, kpi.co2Chg, 'kg');
    };
    
    if (!zoneData || zoneData.length === 0 || !latestTimestampForZone) { 
        reset(); 
        return; 
    }
    
    const now = new Date(latestTimestampForZone);
    const last24hEnd = new Date(now);
    const last24hStart = new Date(now);
    last24hStart.setHours(now.getHours() - 24);

    const prev24hEnd = new Date(last24hStart);
    const prev24hStart = new Date(prev24hEnd);
    prev24hStart.setHours(prev24hEnd.getHours() - 24);

    const last24hData = zoneData.filter(d => d.timestamp >= last24hStart && d.timestamp < last24hEnd);
    const prev24hData = zoneData.filter(d => d.timestamp >= prev24hStart && d.timestamp < prev24hEnd);
    
    const sum = (data, field) => d3.sum(data, d => (typeof d[field] === 'number' ? d[field] : 0));

    const electricityLast24h = sum(last24hData, 'electricity_kwh');
    const costLast24h = sum(last24hData, 'cost_aud');
    const carbonLast24h = sum(last24hData, 'carbon_emissions_kg');
    
    const electricityPrev24h = sum(prev24hData, 'electricity_kwh');
    const costPrev24h = sum(prev24hData, 'cost_aud');
    const carbonPrev24h = sum(prev24hData, 'carbon_emissions_kg');

    if(kpi.eVal) kpi.eVal.textContent = formatKpiValue(electricityLast24h, 'kWh'); 
    if(kpi.cVal) kpi.cVal.textContent = formatKpiValue(costLast24h, 'AUD', true); 
    if(kpi.co2Val) kpi.co2Val.textContent = formatKpiValue(carbonLast24h, 'kg');

    kpi.eVal.className = 'kpi-value';
    kpi.cVal.className = 'kpi-value';
    kpi.co2Val.className = 'kpi-value';

    if (electricityLast24h < 700) kpi.eVal.classList.add('kpi-value-green');
    else if (electricityLast24h <= 1000) kpi.eVal.classList.add('kpi-value-yellow');
    else kpi.eVal.classList.add('kpi-value-red');

    if (costLast24h < 240) kpi.cVal.classList.add('kpi-value-green');
    else if (costLast24h <= 330) kpi.cVal.classList.add('kpi-value-yellow');
    else kpi.cVal.classList.add('kpi-value-red');
    
    if (carbonLast24h < 400) kpi.co2Val.classList.add('kpi-value-green');
    else if (carbonLast24h <= 550) kpi.co2Val.classList.add('kpi-value-yellow');
    else kpi.co2Val.classList.add('kpi-value-red');

    updateKpiChange(kpi.eChg, electricityLast24h, electricityPrev24h, true);
    updateKpiChange(kpi.cChg, costLast24h, costPrev24h, true);
    updateKpiChange(kpi.co2Chg, carbonLast24h, carbonPrev24h, true);
}


function gid(id){return document.getElementById(id);}

/**
 * Updates KPI change text/color.
 */
function updateKpiChange(elem, cur, prev, lowerIsBetter = false) {
    if (!elem) return; 
    elem.className = 'change-indicator'; 
    if (prev === 0 && cur === 0) { 
        elem.textContent = 'No Change'; 
        return; 
    }
    if (prev === 0) { 
        elem.textContent = `New Activity`;
        if (cur > 0) elem.classList.add(lowerIsBetter ? 'kpi-decrease' : 'kpi-increase'); 
        return; 
    }
    const change = ((cur - prev) / prev) * 100;
    if (isNaN(change) || !isFinite(change)) { 
        elem.textContent = 'N/A'; 
        return; 
    }
    const arrow = change > 0 ? '▲' : (change < 0 ? '▼' : '');
    elem.textContent = `${arrow} ${Math.abs(change).toFixed(1)}% from yesterday`;
    if (change > 0) elem.classList.add(lowerIsBetter ? 'kpi-decrease' : 'kpi-increase'); 
    else if (change < 0) elem.classList.add(lowerIsBetter ? 'kpi-increase' : 'kpi-decrease'); 
}

/**
 * Renders air quality gauge.
 */
function renderAirQualityGauge(latestDP) {
    const div=gid('airQualityGauge'), stat=gid('airQualityStatus');
    if (!div || !stat) return;
    if (!latestDP || typeof latestDP.co2_ppm === 'undefined') { 
        div.innerHTML = "<p class='na-center'>N/A</p>"; 
        stat.textContent = "No CO₂ Data"; 
        stat.className='gauge-label'; 
        Plotly.purge(div); 
        return;
    }
    const co2=latestDP.co2_ppm;
    const band=getCO2Band(co2);
    const data = [{
        type:"indicator",
        mode:"gauge+number",
        value:co2,
        title:{text:"CO₂ Value (ppm)",font:{size:10, family: 'Segoe UI, sans-serif'}}, 
        number:{font:{size:24, family: 'Segoe UI, sans-serif'}}, 
        gauge:{
            axis:{range:[0, 1600],tick0:0,dtick:400,tickfont:{size:8, family: 'Segoe UI, sans-serif'}},
            bar:{color:band.color},
            bgcolor:"white",
            borderwidth:1,
            bordercolor:"#ddd",
            steps:[
                {range:[0,600], color: "rgba(16, 185, 129, 0.2)"}, // Green
                {range:[600,1000], color: "rgba(245, 158, 11, 0.2)"}, // Yellow
                {range:[1000,1600], color: "rgba(239, 68, 68, 0.2)"} // Red
            ],
            threshold:{line:{color:"#e74c3c",width:3},thickness:0.8,value:1000}
        }
    }];
    
    const layout = {
        width: 250, 
        height: 120, 
        margin: { t: 10, r: 10, b: 10, l: 10 }, 
        paper_bgcolor:'rgba(0,0,0,0)',
        plot_bgcolor:'rgba(0,0,0,0)'
    }; 
    
    Plotly.react(div,data,layout,{responsive:true, displaylogo: false});
    stat.textContent=`${band.name} Air Quality`; 
    stat.className=`gauge-label ${band.className.replace('co2-','vent-')}`;
}

/**
 * Renders Occupancy widget (moved to left pane).
 */
function renderOccupancyWidget(latestDP) {
    const occEl = gid('occupancyStatus');
    if (!occEl) return;
    if (!latestDP) {
        occEl.textContent = 'N/A';
        return;
    }
    occEl.textContent = latestDP.occupancy_status || 'N/A';
}

/**
 * Renders ventilation log.
 */
function renderVentilationLog(zoneData) {
    const logUl=gid('ventilationLogList'); if(!logUl) return; logUl.innerHTML='';
    if(!zoneData || zoneData.length === 0 || !zoneData.some(d=>typeof d.co2_ppm!=='undefined' || typeof d.ahu_fan_speed_percent !== 'undefined')){
        logUl.innerHTML='<li>No relevant data for log.</li>';return;
    }
    if(zoneData.length<2){logUl.innerHTML='<li>Not enough data points to show changes.</li>';return;}

    const sorted=zoneData.sort((a,b)=>b.timestamp-a.timestamp), events=[];
    for(let i=0;i<sorted.length-1&&events.length<4;i++){ 
        const cur=sorted[i],prev=sorted[i+1];
        if(typeof cur.ahu_fan_speed_percent!=='undefined'&&typeof prev.ahu_fan_speed_percent!=='undefined'){
            if(cur.ahu_fan_speed_percent !== prev.ahu_fan_speed_percent && Math.abs(cur.ahu_fan_speed_percent-prev.ahu_fan_speed_percent)>5){
                events.push(`${formatTime(cur.timestamp)} – Vent. ${cur.ahu_fan_speed_percent>prev.ahu_fan_speed_percent?"increased":"decreased"} to ${cur.ahu_fan_speed_percent.toFixed(0)}%`);
            }
        }
        if(events.length>=4)break;
        if(typeof cur.co2_ppm!=='undefined'&&typeof prev.co2_ppm!=='undefined'){
            const cb=getCO2Band(cur.co2_ppm).name,pb=getCO2Band(prev.co2_ppm).name;
            if(cb!==pb&&cb!=="N/A"&&pb!=="N/A"){events.push(`${formatTime(cur.timestamp)} – CO₂ to ${cb} (${cur.co2_ppm.toFixed(0)}ppm)`);}
        }
    }
    if(events.length>0)logUl.innerHTML=events.map(e=>`<li>${e}</li>`).join(''); else logUl.innerHTML='<li>No recent significant changes.</li>';
}

/**
 * Renders alerts list (Building-Wide).
 */
function renderAlerts() { 
    const ul=gid('alertsList'); if(!ul) return; ul.innerHTML='';
    const alertTitle = document.querySelector('.alerts-status > h3.widget-title');
    if(alertTitle) alertTitle.textContent = `Building Alerts & Status`;

    const buildingAlerts = allData.filter(d => d.alert_flag === true)
                                .sort((a,b)=>b.timestamp-a.timestamp)
                                .slice(0,5); 

    if(buildingAlerts.length > 0){
        buildingAlerts.forEach(a=>{ 
            const li=document.createElement('li');
            li.innerHTML = `<span class="alert-icon">⚠️</span> ${formatTime(a.timestamp)} - Zone ${a.zone_id}: ${a.alert_message||'Unspecified Alert'}`; 
            ul.appendChild(li);
        });
    } else {
        ul.innerHTML='<li>No active building-wide alerts.</li>';
    }
}

/**
 * Renders mini cards for System Snapshot.
 */
function renderSystemSnapshotMiniCards(latestDP) {
    const ahuEl = gid('ahuFanSpeedMini');
    const dampEl = gid('freshAirDamper');
    const ventStatusMiniEl = gid('ventilationStatusMini'); 

    if (!latestDP) { 
        if(ahuEl) ahuEl.textContent = 'N/A %'; 
        if(dampEl) dampEl.textContent = 'N/A % Open'; 
        if(ventStatusMiniEl) {
            ventStatusMiniEl.textContent = 'N/A';
            ventStatusMiniEl.className = 'vent-unknown'; 
        }
        return; 
    }

    if(ahuEl) ahuEl.textContent = typeof latestDP.ahu_fan_speed_percent !== 'undefined' ? `${latestDP.ahu_fan_speed_percent.toFixed(0)}%` : 'N/A %';
    if(dampEl) dampEl.textContent = typeof latestDP.fresh_air_damper_percent !== 'undefined' ? `${latestDP.fresh_air_damper_percent.toFixed(0)}% Open` : 'N/A % Open';

    if (ventStatusMiniEl) {
        if (typeof latestDP.ahu_fan_speed_percent !== 'undefined') {
            const ventS = getVentilationStatus(latestDP.ahu_fan_speed_percent);
            ventStatusMiniEl.textContent = ventS.name;
            ventStatusMiniEl.className = ventS.className; 
        } else {
            ventStatusMiniEl.textContent = 'N/A';
            ventStatusMiniEl.className = 'vent-unknown';
        }
    }
}

// --- Helper Functions ---
function getLatestDataPoint(dataArray){
    if(!dataArray || dataArray.length===0) return null;
    const valid=dataArray.filter(d=>d.timestamp instanceof Date&&!isNaN(d.timestamp));
    if(valid.length===0) return null;
    const latestPoint = valid.reduce((l,c)=>(c.timestamp>l.timestamp?c:l),valid[0]);
    return latestPoint;
}
function getCO2Band(co2Val){if(typeof co2Val==='undefined'||co2Val===null)return{name:"N/A",className:"co2-unknown",color:"#BDC3C7"};if(co2Val<=600)return{name:"Excellent",className:"co2-excellent",color:"#26a69a"};if(co2Val<=1000)return{name:"Moderate",className:"co2-moderate",color:"#42a5f5"};return{name:"High",className:"co2-high",color:"#ab47bc"};}
function getVentilationStatus(fanSpeed){if(typeof fanSpeed==='undefined'||fanSpeed===null)return{name:"N/A",className:"vent-unknown"};if(fanSpeed<=40)return{name:"Optimal",className:"vent-optimal"};if(fanSpeed<=70)return{name:"Normal",className:"vent-normal"};return{name:"High",className:"vent-high"};} 
function formatTime(date){if(!date||!(date instanceof Date)||isNaN(date))return"Invalid Date";return date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:true});}

function showToast(message){const t=gid('toastNotification');if(!t)return;t.textContent=message;t.classList.add('show');setTimeout(()=>{t.classList.remove('show');},3000);}
