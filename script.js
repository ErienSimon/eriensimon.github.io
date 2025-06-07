// Initial Pie Chart Script and Scroll-to-Dashboard functionality
document.addEventListener('DOMContentLoaded', function() {
    
    // --- Scroll-to-Dashboard ---
    const viewDemoBtn = document.getElementById('viewDemoBtn');
    const dashboardSection = document.getElementById('live-dashboard');

    if (viewDemoBtn && dashboardSection) {
        viewDemoBtn.addEventListener('click', function(event) {
            event.preventDefault(); // Prevent any default anchor behavior
            dashboardSection.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // --- Energy Consumption Pie Chart ---
    // Check if the pie chart container exists before trying to create the chart
    if (document.getElementById('pie-chart-container')) {
        const data = [{
            values: [39, 31, 21, 9],
            labels: ['HVAC', 'Lighting', 'Equipment', 'Others'],
            type: 'pie',
            marker: { colors: ['#6a4c9c', '#8b72b6', '#ac9fcf', '#d0cce8'] },
            hole: .4,
            textinfo: 'label+percent',
            insidetextorientation: 'radial',
            texttemplate: '%{percent:.0%}',
            hoverinfo: 'label+percent',
            textfont: { size: 16, color: 'white' },
            automargin: true
        }];

        const layout = {
            title: { text: 'Energy consumption in an office building', font: { family: 'Inter, sans-serif', size: 16, color: '#475569' }, y: 0.95 },
            showlegend: true,
            legend: { font: { family: 'Inter, sans-serif' } },
            height: 400,
            width: 400,
            margin: {"t": 60, "b": 100, "l": 20, "r": 20},
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        };
        
        Plotly.newPlot('pie-chart-container', data, layout, { displayModeBar: false, responsive: true });
    }

    // --- How DCV Transformed an Office Charts ---
    if (document.getElementById('energyChart')) {
        const energyCsvData = `Hour,Traditional HVAC Energy Use ,DCV HVAC Energy Use (%)
        12:00 AM,30,20\n1:00 AM,30,20\n2:00 AM,30,20\n3:00 AM,30,20\n4:00 AM,30,20\n5:00 AM,30,20\n6:00 AM,30,20\n7:00 AM,30,20\n8:00 AM,30,21\n9:00 AM,30,33\n10:00 AM,50,38\n11:00 AM,50,38\n12:00 PM,30,36\n1:00 PM,30,34\n2:00 PM,30,35\n3:00 PM,30,36\n4:00 PM,30,35\n5:00 PM,30,31\n6:00 PM,30,24\n7:00 PM,30,21\n8:00 PM,30,22\n9:00 PM,30,22\n10:00 PM,30,21\n11:00 PM,30,20`;
        const co2CsvData = `Hour,Average CO₂ Concentration (ppm),Estimated Average CO₂ with DCV (ppm)
        12:00 AM,490,489\n1:00 AM,483,482\n2:00 AM,476,475\n3:00 AM,470,469\n4:00 AM,465,463\n5:00 AM,461,459\n6:00 AM,461,459\n7:00 AM,468,466\n8:00 AM,506,496\n9:00 AM,579,450\n10:00 AM,608,424\n11:00 AM,610,422\n12:00 PM,593,437\n1:00 PM,581,448\n2:00 PM,592,439\n3:00 PM,594,437\n4:00 PM,591,439\n5:00 PM,567,460\n6:00 PM,522,488\n7:00 PM,506,496\n8:00 PM,513,493\n9:00 PM,513,493\n10:00 PM,506,496\n11:00 PM,497,495`;
        const hvacDataHeatmap = [ [495,455,505,482,513,500,483], [490,453,492,473,506,492,478], [487,446,480,466,499,484,472], [485,439,470,460,493,478,468], [481,435,461,456,488,471,461], [479,430,457,453,486,465,457], [489,428,455,455,482,462,456], [508,437,452,466,487,465,459], [530,485,478,510,522,513,503], [585,570,565,577,577,595,582], [608,612,607,599,614,605,609], [648,604,615,591,610,596,603], [599,576,596,587,600,595,601], [593,560,572,575,600,585,585], [585,586,589,590,596,603,594], [592,592,601,582,595,607,592], [584,590,599,595,582,607,583], [563,550,577,580,557,585,553], [538,490,532,533,529,526,506], [520,471,516,510,524,507,490], [516,475,536,518,532,516,499], [512,476,539,512,531,516,501], [505,468,530,502,526,513,497], [499,454,518,490,520,506,490] ];
        const dcvDataHeatmap = [ [480.15,441.35,469.65,467.54,477.09,485,468.51], [475.3,439.41,477.24,458.81,470.58,477.24,463.66], [472.39,432.62,465.6,452.02,484.03,469.48,457.84], [470.45,425.83,455.9,446.2,478.21,463.66,453.96], [466.57,421.95,447.17,442.32,473.36,456.87,447.17], [464.63,417.1,443.29,439.41,471.42,451.05,443.29], [474.33,415.16,441.35,441.35,467.54,448.14,442.32], [472.44,423.89,438.44,452.02,472.39,451.05,445.23], [492.9,470.45,463.66,474.3,485.46,477.09,467.79], [544.05,530.1,525.45,536.61,536.61,553.35,541.26], [535.04,538.56,534.16,557.07,540.32,532.4,535.92], [570.24,531.52,541.2,549.63,536.8,554.28,530.64], [557.07,535.68,554.28,545.91,558,553.35,528.88], [551.49,520.8,531.96,534.75,558,544.05,544.05], [544.05,544.98,547.77,548.7,554.28,530.64,552.42], [550.56,550.56,528.88,541.26,553.35,534.16,550.56], [543.12,548.7,557.07,553.35,541.26,534.16,542.19], [523.59,511.5,536.61,539.4,518.01,544.05,514.29], [500.34,475.3,494.76,495.69,491.97,489.18,470.58], [483.6,456.87,479.88,474.3,487.32,471.51,475.3], [479.88,460.75,498.48,481.74,494.76,479.88,484.03], [476.16,461.72,501.27,476.16,493.83,479.88,465.93], [469.65,453.96,492.9,466.86,489.18,477.09,482.09], [484.03,440.38,481.74,475.3,483.6,470.58,475.3] ];
        const heatmapHours = [ '12:00 AM', '1:00 AM', '2:00 AM', '3:00 AM', '4:00 AM', '5:00 AM', '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM', '11:00 PM' ];
        const heatmapZones = ['Floor 0', 'Floor 25', 'Floor 26', 'Floor 27', 'Floor 28', 'Floor 29', 'Floor 30'];
        
        const energyData = parseLineChartData(energyCsvData);
        const co2Data = parseLineChartData(co2CsvData);
        function parseLineChartData(csvString) {
            const lines = csvString.trim().split('\n').slice(1);
            const hours = [], series1 = [], series2 = [];
            for (const line of lines) {
                const [hour, val1, val2] = line.split(',');
                hours.push(hour.trim());
                series1.push(parseInt(val1.trim()));
                series2.push(parseInt(val2.trim()));
            }
            return { hours, series1, series2 };
        }
        
        document.getElementById('avgSavings').textContent = '18%';
        document.getElementById('avgCO2Reduction').textContent = '12%';
        function calculateHeatmapStats(data) {
            const flatData = data.flat();
            const sum = flatData.reduce((acc, val) => acc + val, 0);
            const average = sum / flatData.length;
            const peak = Math.max(...flatData);
            const min = Math.min(...flatData);
            return { average, peak, min };
        }
        function updateHeatmapStats(stats) {
            document.getElementById('avg-co2-heatmap').textContent = stats.average.toFixed(0);
            document.getElementById('peak-co2-heatmap').textContent = stats.peak.toFixed(0);
            document.getElementById('min-co2-heatmap').textContent = stats.min.toFixed(0);
        }

        const colors = { hvac: '#615BA1', dcv: '#02A596', hvacFill: 'rgba(97, 91, 161, 0.1)', dcvFill: 'rgba(2, 165, 150, 0.1)', grid: '#e5e7eb', text: '#6B7280', };
        const baseLayout = { plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)', showlegend: false, font: { family: 'Inter, sans-serif', color: colors.text }, xaxis: { gridcolor: colors.grid, tickfont: {size: 10} }, yaxis: { gridcolor: colors.grid, tickfont: {size: 10} }, margin: { l: 40, r: 20, t: 20, b: 30 } };
        const responsiveConfig = { responsive: true, displayModeBar: false };

        Plotly.newPlot('energyChart', [ { x: energyData.hours, y: energyData.series1, name: 'Traditional', line: { color: colors.hvac, width: 2.5 }, fill: 'tozeroy', fillcolor: colors.hvacFill, type: 'scatter' }, { x: energyData.hours, y: energyData.series2, name: 'DCV', line: { color: colors.dcv, width: 2.5 }, fill: 'tozeroy', fillcolor: colors.dcvFill, type: 'scatter' } ], { ...baseLayout, yaxis: {...baseLayout.yaxis, title: {text: "Energy Consumption (%)", font: {size: 12}}} }, responsiveConfig);
        Plotly.newPlot('co2Chart', [ { x: co2Data.hours, y: co2Data.series1, name: 'Traditional', line: { color: colors.hvac, width: 2.5 }, fill: 'tozeroy', fillcolor: colors.hvacFill, type: 'scatter' }, { x: co2Data.hours, y: co2Data.series2, name: 'DCV', line: { color: colors.dcv, width: 2.5 }, fill: 'tozeroy', fillcolor: colors.dcvFill, type: 'scatter' } ], { ...baseLayout, yaxis: {...baseLayout.yaxis, title: {text: "CO₂ (ppm)", font: {size: 12}}} }, responsiveConfig);

        const allHeatmapData = hvacDataHeatmap.flat().concat(dcvDataHeatmap.flat());
        const heatmapMin = Math.min(...allHeatmapData);
        const heatmapMax = Math.max(...allHeatmapData);

        function createHeatmap(data) {
            Plotly.newPlot('heatmapChart', [{
                z: data, x: heatmapZones, y: heatmapHours,
                type: 'heatmap', colorscale: 'Viridis', reversescale: true,
                zmin: heatmapMin,
                zmax: heatmapMax,
                hovertemplate: '<b>%{x}</b> @ %{y}<br>CO₂: %{z:.0f} ppm<extra></extra>',
                colorbar: { title: {text:'CO₂ (ppm)', side: 'right'}, titleside: 'right', thickness: 15, len: 0.75, tickfont: {size: 10} }
            }], { ...baseLayout, yaxis: { ...baseLayout.yaxis, autorange: 'reversed', tickfont: {size: 9} }, xaxis: { ...baseLayout.xaxis, tickangle: 0}, margin: { l: 60, r: 10, t: 10, b: 50 } }, responsiveConfig);
        }
        
        const hvacBtn = document.getElementById('hvac-btn');
        const dcvBtn = document.getElementById('dcv-btn');
        
        if(hvacBtn && dcvBtn) {
            hvacBtn.addEventListener('click', () => { updateHeatmapStats(calculateHeatmapStats(hvacDataHeatmap)); createHeatmap(hvacDataHeatmap); hvacBtn.classList.add('active'); dcvBtn.classList.remove('active'); });
            dcvBtn.addEventListener('click', () => { updateHeatmapStats(calculateHeatmapStats(dcvDataHeatmap)); createHeatmap(dcvDataHeatmap); dcvBtn.classList.add('active'); hvacBtn.classList.remove('active'); });
        
            // Initial load for heatmap
            updateHeatmapStats(calculateHeatmapStats(hvacDataHeatmap));
            createHeatmap(hvacDataHeatmap);
        }
    }
});
