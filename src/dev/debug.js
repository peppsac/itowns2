let _chartCount = 0;
import $script from 'scriptjs';

var canvasJsLoadingPromise;
function loadCanvasJs() {
    if (!canvasJsLoadingPromise) {
        canvasJsLoadingPromise = new Promise(function(resolve) {
             $script.get('http://canvasjs.com/assets/script/canvasjs.min.js', function () {
                resolve(true);
            });
        });
    }
    return canvasJsLoadingPromise;
}


function updateLineChart() {
    let chart = this;
    var ts = chart.start++;

    let cnt = chart.options.data.length;
    for (let i=0; i<cnt; i++) {
        chart.options.data[i].dataPoints.push(
            { x: ts,
              y: chart.content.data[i].data(chart.content.context)
            });
        while (chart.options.data[i].dataPoints.length > 60) {
            chart.options.data[i].dataPoints.shift();
        }
    }

    chart.render();
}

export function createChart(containerId, title, content) {
    if (__DEV__) {
        return loadCanvasJs().then(function() {
            let name = 'debugDiv-' + _chartCount++;
            let d = document.createElement('div');
            d.id = name;
            document.getElementById(containerId).appendChild(d);

            var start = Date.now();

            var chart = new CanvasJS.Chart(
                name,
                {
                    title: { text: title },
                    axisX:{ stripLines: [ ] }
                }
            );

            chart.options.data = [];
            chart.start = 0;
            chart.content = content;

            for (let i=0; i<content.data.length; i++) {
                chart.options.data.push({
                    type: 'line',
                    showInLegend: true,
                    name: content.data[i].title,
                    dataPoints: [ ]
                });
            }

            return { update: updateLineChart.bind(chart), chart };
        });
    }
}


function updateColumnChart() {
    let chart = this;
    let cnt = chart.options.data.length;
    for (let i=0; i<cnt; i++) {
        let d = chart.content.data[i].data(chart.content.context);
        for (let j=0; j<d.length; j++) {
            chart.options.data[i].dataPoints = d;
        }
    }

    chart.render();
}

export function createColumnChart(containerId, title, content) {
    if (__DEV__) {
        return loadCanvasJs().then(function() {
            let name = 'debugDiv-' + _chartCount++;
            let d = document.createElement('div');
            d.id = name;
            document.getElementById(containerId).appendChild(d);

            var chart = new CanvasJS.Chart(
                name,
                { title: { text: title } }
                );

            chart.options.data = [];
            chart.content = content;

            for (let i=0; i<content.data.length; i++) {
                chart.options.data.push({
                    type: 'column',
                    showInLegend: true,
                    name: content.data[i].title,
                    dataPoints: [ {  }]
                });
            }



            return { update: updateColumnChart.bind(chart) };
        });
    }
}
