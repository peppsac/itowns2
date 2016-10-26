import $script from 'scriptjs';

let _chartCount = 0;

var canvasJsLoadingPromise;
function loadCanvasJs() {
    if (!canvasJsLoadingPromise) {
        canvasJsLoadingPromise = new Promise((resolve) => {
            $script.get('http://canvasjs.com/assets/script/canvasjs.min.js', () => {
                resolve(true);
            });
        });
    }
    return canvasJsLoadingPromise;
}


function updateLineChart() {
    const chart = this;
    const ts = chart.start++;

    const cnt = chart.options.data.length;
    for (let i = 0; i < cnt; i++) {
        chart.options.data[i].dataPoints.push(
            {
                x: ts,
                y: chart.content.data[i].data(chart.content.context),
            });
        while (chart.options.data[i].dataPoints.length > 60) {
            chart.options.data[i].dataPoints.shift();
        }
    }

    chart.render();
}

export function createChart(containerId, title, content) {
    if (__DEV__) {
        return loadCanvasJs().then(() => {
            const name = `debugDiv-${_chartCount++}`;
            const d = document.createElement('div');
            d.id = name;
            document.getElementById(containerId).appendChild(d);

            /* eslint-disable no-undef */
            const chart = new CanvasJS.Chart(
                name,
                {
                    title: { text: title },
                    axisX: { stripLines: [] },
                });
            /* eslint-enable no-undef */

            chart.options.data = [];
            chart.start = 0;
            chart.content = content;

            for (let i = 0; i < content.data.length; i++) {
                chart.options.data.push({
                    type: 'line',
                    showInLegend: true,
                    name: content.data[i].title,
                    dataPoints: [],
                });
            }

            return { update: updateLineChart.bind(chart), chart };
        });
    }
}


function updateColumnChart() {
    const chart = this;
    const cnt = chart.options.data.length;
    for (let i = 0; i < cnt; i++) {
        const d = chart.content.data[i].data(chart.content.context);
        for (let j = 0; j < d.length; j++) {
            chart.options.data[i].dataPoints = d;
        }
    }

    chart.render();
}

export function createColumnChart(containerId, title, content) {
    if (__DEV__) {
        return loadCanvasJs().then(() => {
            const name = `debugDiv-${_chartCount++}`;
            const d = document.createElement('div');
            d.id = name;
            document.getElementById(containerId).appendChild(d);

            /* eslint-disable no-undef */
            var chart = new CanvasJS.Chart(
                name,
                {
                    title: { text: title },
                });
            /* eslint-enable no-undef */

            chart.options.data = [];
            chart.content = content;

            for (let i = 0; i < content.data.length; i++) {
                chart.options.data.push({
                    type: 'column',
                    showInLegend: true,
                    name: content.data[i].title,
                    dataPoints: [{ }],
                });
            }

            return { update: updateColumnChart.bind(chart) };
        });
    }
}
