const sampleCsv = `广告投入,销售额
10,32
12,35
15,41
18,47
20,49
24,58
28,63
32,72
36,78
40,86
45,94
50,103`;

const state = {
    headers: [],
    rows: [],
    lastSvg: ""
};

const els = {
    csvInput: document.getElementById("csvInput"),
    fileInput: document.getElementById("fileInput"),
    parseBtn: document.getElementById("parseBtn"),
    clearBtn: document.getElementById("clearBtn"),
    loadSampleBtn: document.getElementById("loadSampleBtn"),
    previewTable: document.getElementById("previewTable"),
    rowCount: document.getElementById("rowCount"),
    xSelect: document.getElementById("xSelect"),
    ySelect: document.getElementById("ySelect"),
    analyzeBtn: document.getElementById("analyzeBtn"),
    message: document.getElementById("message"),
    equation: document.getElementById("equation"),
    rSquared: document.getElementById("rSquared"),
    correlation: document.getElementById("correlation"),
    rmse: document.getElementById("rmse"),
    sampleSize: document.getElementById("sampleSize"),
    mae: document.getElementById("mae"),
    chart: document.getElementById("chart"),
    chartSubtitle: document.getElementById("chartSubtitle"),
    diagnostics: document.getElementById("diagnostics"),
    downloadBtn: document.getElementById("downloadBtn")
};

function parseCsv(text) {
    const rows = [];
    let current = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                field += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            current.push(field.trim());
            field = "";
        } else if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && next === "\n") i += 1;
            current.push(field.trim());
            if (current.some(value => value !== "")) rows.push(current);
            current = [];
            field = "";
        } else {
            field += char;
        }
    }

    current.push(field.trim());
    if (current.some(value => value !== "")) rows.push(current);

    if (rows.length < 2) {
        throw new Error("CSV 至少需要一行表头和一行数据。");
    }

    const headers = rows[0].map((header, index) => header || `列${index + 1}`);
    const dataRows = rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index] ?? "";
        });
        return obj;
    });

    return { headers, rows: dataRows };
}

function toNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const cleaned = String(value).replace(/[%￥¥,\s]/g, "");
    if (cleaned === "") return null;
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : null;
}

function setMessage(text, type = "") {
    els.message.textContent = text;
    els.message.className = `message ${type}`.trim();
}

function renderPreview() {
    const thead = els.previewTable.querySelector("thead");
    const tbody = els.previewTable.querySelector("tbody");
    thead.innerHTML = "";
    tbody.innerHTML = "";

    if (!state.headers.length) {
        els.rowCount.textContent = "0 行";
        return;
    }

    const headerRow = document.createElement("tr");
    state.headers.forEach(header => {
        const th = document.createElement("th");
        th.textContent = header;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    state.rows.slice(0, 12).forEach(row => {
        const tr = document.createElement("tr");
        state.headers.forEach(header => {
            const td = document.createElement("td");
            td.textContent = row[header];
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    els.rowCount.textContent = `${state.rows.length} 行`;
}

function populateSelects() {
    els.xSelect.innerHTML = "";
    els.ySelect.innerHTML = "";

    state.headers.forEach((header, index) => {
        const xOption = document.createElement("option");
        xOption.value = header;
        xOption.textContent = header;
        els.xSelect.appendChild(xOption);

        const yOption = document.createElement("option");
        yOption.value = header;
        yOption.textContent = header;
        els.ySelect.appendChild(yOption);

        if (index === 1) yOption.selected = true;
    });
}

function parseInput() {
    try {
        const parsed = parseCsv(els.csvInput.value.trim());
        state.headers = parsed.headers;
        state.rows = parsed.rows;
        renderPreview();
        populateSelects();
        setMessage(`解析成功：${state.rows.length} 行，${state.headers.length} 列。`, "success");
    } catch (error) {
        setMessage(error.message, "error");
    }
}

function linearRegression(points) {
    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const meanX = sumX / n;
    const meanY = sumY / n;

    let sxx = 0;
    let syy = 0;
    let sxy = 0;

    points.forEach(point => {
        const dx = point.x - meanX;
        const dy = point.y - meanY;
        sxx += dx * dx;
        syy += dy * dy;
        sxy += dx * dy;
    });

    if (sxx === 0) {
        throw new Error("X 列没有变化，无法计算线性回归。");
    }

    const slope = sxy / sxx;
    const intercept = meanY - slope * meanX;
    const predictions = points.map(point => ({ ...point, yHat: slope * point.x + intercept }));
    const residuals = predictions.map(point => point.y - point.yHat);
    const sse = residuals.reduce((sum, r) => sum + r * r, 0);
    const mae = residuals.reduce((sum, r) => sum + Math.abs(r), 0) / n;
    const rmse = Math.sqrt(sse / n);
    const rSquared = syy === 0 ? 1 : 1 - (sse / syy);
    const correlation = syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);

    return { slope, intercept, rSquared, correlation, rmse, mae, n, predictions, sse, syy };
}

function formatNumber(value, digits = 4) {
    if (!Number.isFinite(value)) return "--";
    const abs = Math.abs(value);
    if (abs >= 100000 || (abs > 0 && abs < 0.001)) return value.toExponential(3);
    return Number(value.toFixed(digits)).toLocaleString("zh-CN");
}

function extractPoints(xKey, yKey) {
    return state.rows
        .map((row, index) => ({ x: toNumber(row[xKey]), y: toNumber(row[yKey]), index: index + 1 }))
        .filter(point => point.x !== null && point.y !== null);
}

function renderMetrics(result, xKey, yKey) {
    const sign = result.intercept >= 0 ? "+" : "-";
    els.equation.textContent = `ŷ = ${formatNumber(result.slope)}x ${sign} ${formatNumber(Math.abs(result.intercept))}`;
    els.rSquared.textContent = formatNumber(result.rSquared, 5);
    els.correlation.textContent = formatNumber(result.correlation, 5);
    els.rmse.textContent = formatNumber(result.rmse, 4);
    els.sampleSize.textContent = String(result.n);
    els.mae.textContent = formatNumber(result.mae, 4);
    els.chartSubtitle.textContent = `${xKey} → ${yKey}，使用 ${result.n} 个有效样本`;
}

function chartScales(points, width, height, padding) {
    const xs = points.map(p => p.x);
    const ys = points.flatMap(p => [p.y, p.yHat ?? p.y]);
    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);

    const xPad = (maxX - minX || 1) * 0.08;
    const yPad = (maxY - minY || 1) * 0.12;
    minX -= xPad;
    maxX += xPad;
    minY -= yPad;
    maxY += yPad;

    const xScale = x => padding.left + ((x - minX) / (maxX - minX)) * (width - padding.left - padding.right);
    const yScale = y => height - padding.bottom - ((y - minY) / (maxY - minY)) * (height - padding.top - padding.bottom);

    return { minX, maxX, minY, maxY, xScale, yScale };
}

function renderChart(result, xKey, yKey) {
    const width = 980;
    const height = 560;
    const padding = { top: 42, right: 42, bottom: 76, left: 82 };
    const points = result.predictions;
    const scales = chartScales(points, width, height, padding);
    const lineStartX = Math.min(...points.map(p => p.x));
    const lineEndX = Math.max(...points.map(p => p.x));
    const lineStartY = result.slope * lineStartX + result.intercept;
    const lineEndY = result.slope * lineEndX + result.intercept;

    const grid = Array.from({ length: 6 }, (_, i) => {
        const t = i / 5;
        const y = padding.top + t * (height - padding.top - padding.bottom);
        const value = scales.maxY - t * (scales.maxY - scales.minY);
        return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e2e8f0"/><text x="${padding.left - 12}" y="${y + 5}" text-anchor="end" fill="#64748b" font-size="13">${formatNumber(value, 2)}</text>`;
    }).join("");

    const xTicks = Array.from({ length: 6 }, (_, i) => {
        const t = i / 5;
        const x = padding.left + t * (width - padding.left - padding.right);
        const value = scales.minX + t * (scales.maxX - scales.minX);
        return `<line x1="${x}" y1="${height - padding.bottom}" x2="${x}" y2="${height - padding.bottom + 6}" stroke="#94a3b8"/><text x="${x}" y="${height - padding.bottom + 28}" text-anchor="middle" fill="#64748b" font-size="13">${formatNumber(value, 2)}</text>`;
    }).join("");

    const dots = points.map(point => {
        const cx = scales.xScale(point.x);
        const cy = scales.yScale(point.y);
        return `<circle cx="${cx}" cy="${cy}" r="7" fill="#06b6d4" stroke="#ffffff" stroke-width="3"><title>第${point.index}行：${xKey}=${point.x}, ${yKey}=${point.y}, 预测=${formatNumber(point.yHat, 4)}</title></circle>`;
    }).join("");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xKey} 和 ${yKey} 的线性回归图表">
        <rect width="${width}" height="${height}" fill="#fbfdff"/>
        <g>${grid}</g>
        <g>${xTicks}</g>
        <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#334155" stroke-width="2"/>
        <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#334155" stroke-width="2"/>
        <line x1="${scales.xScale(lineStartX)}" y1="${scales.yScale(lineStartY)}" x2="${scales.xScale(lineEndX)}" y2="${scales.yScale(lineEndY)}" stroke="#4f46e5" stroke-width="5" stroke-linecap="round"/>
        <g>${dots}</g>
        <text x="${width / 2}" y="${height - 22}" text-anchor="middle" fill="#172033" font-size="16" font-weight="700">${escapeXml(xKey)}</text>
        <text x="24" y="${height / 2}" text-anchor="middle" transform="rotate(-90 24 ${height / 2})" fill="#172033" font-size="16" font-weight="700">${escapeXml(yKey)}</text>
        <rect x="${width - 278}" y="30" width="228" height="82" rx="16" fill="#ffffff" stroke="#dbe3ef"/>
        <circle cx="${width - 252}" cy="58" r="6" fill="#06b6d4"/><text x="${width - 236}" y="63" fill="#475569" font-size="14">实际数据</text>
        <line x1="${width - 258}" y1="88" x2="${width - 236}" y2="88" stroke="#4f46e5" stroke-width="5" stroke-linecap="round"/><text x="${width - 222}" y="93" fill="#475569" font-size="14">拟合线</text>
    </svg>`;

    state.lastSvg = svg;
    els.chart.innerHTML = svg;
}

function escapeXml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderDiagnostics(result) {
    const items = [];
    const absR = Math.abs(result.correlation);

    if (result.rSquared >= 0.85) {
        items.push("R² 很高：线性模型解释了大部分 Y 的波动。仍建议检查是否有异常值或非线性模式。");
    } else if (result.rSquared >= 0.5) {
        items.push("R² 中等：存在一定线性关系，但仍有较多波动未被解释。可以考虑增加变量或分组分析。");
    } else {
        items.push("R² 较低：单变量线性模型解释能力有限，可能需要非线性模型、更多变量或重新检查数据质量。");
    }

    items.push(result.slope >= 0 ? "斜率为正：X 增加时，Y 倾向于上升。" : "斜率为负：X 增加时，Y 倾向于下降。");
    items.push(absR >= 0.8 ? "相关系数绝对值较高，线性相关较强。" : "相关系数绝对值不高，线性相关可能较弱或存在离群点。");
    items.push("注意：线性回归描述相关关系，不自动证明因果关系。");

    els.diagnostics.innerHTML = items.map(item => `<li>${item}</li>`).join("");
}

function analyze() {
    try {
        if (!state.rows.length) parseInput();
        const xKey = els.xSelect.value;
        const yKey = els.ySelect.value;
        if (!xKey || !yKey) throw new Error("请选择 X 和 Y 列。");
        if (xKey === yKey) throw new Error("X 和 Y 不能选择同一列。");

        const points = extractPoints(xKey, yKey);
        if (points.length < 2) throw new Error("有效数值样本不足，至少需要 2 行。");

        const result = linearRegression(points);
        renderMetrics(result, xKey, yKey);
        renderChart(result, xKey, yKey);
        renderDiagnostics(result);
        setMessage(`分析完成：跳过 ${state.rows.length - points.length} 行无效或空值数据。`, "success");
    } catch (error) {
        setMessage(error.message, "error");
    }
}

function clearAll() {
    els.csvInput.value = "";
    state.headers = [];
    state.rows = [];
    state.lastSvg = "";
    renderPreview();
    populateSelects();
    els.chart.innerHTML = "";
    els.chartSubtitle.textContent = "等待数据分析";
    [els.equation, els.rSquared, els.correlation, els.rmse, els.sampleSize, els.mae].forEach(el => {
        el.textContent = "--";
    });
    els.diagnostics.innerHTML = "<li>请先输入数据并运行分析。</li>";
    setMessage("已清空。", "");
}

function downloadSvg() {
    if (!state.lastSvg) {
        setMessage("请先运行分析再下载图表。", "error");
        return;
    }
    const blob = new Blob([state.lastSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "linear-regression-chart.svg";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

els.parseBtn.addEventListener("click", parseInput);
els.analyzeBtn.addEventListener("click", analyze);
els.clearBtn.addEventListener("click", clearAll);
els.downloadBtn.addEventListener("click", downloadSvg);
els.loadSampleBtn.addEventListener("click", () => {
    els.csvInput.value = sampleCsv;
    parseInput();
    analyze();
    document.getElementById("analysis").scrollIntoView({ behavior: "smooth", block: "start" });
});
els.fileInput.addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        els.csvInput.value = String(reader.result || "");
        parseInput();
    };
    reader.onerror = () => setMessage("文件读取失败，请重试。", "error");
    reader.readAsText(file, "UTF-8");
});

els.csvInput.value = sampleCsv;
parseInput();
analyze();
