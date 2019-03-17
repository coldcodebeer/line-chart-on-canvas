class LineChart {
  constructor({ root, data, offset }) {
    this.data = normalizeData(data);
    this.root = root;
    this.offset = { left: 20, right: 20, ...offset };
    this.nodes = {
      container: {
        backNode: document.createElement("div"),
        node: document.createElement("div"),
      },
      canvas: {
        node: document.createElement("canvas"),
        backNode: document.createElement("canvas"),
        height: 400,
        lineWidth: 3,
      },
      previewCanvas: {
        backNode: document.createElement("canvas"),
        node: document.createElement("canvas"),
        height: 54,
        lineWidth: 1,
      },
    };

    const devicePixelRatio = window.devicePixelRatio || 1;

    this.controlBorderWidth = 5 * devicePixelRatio;
    this.startPanelGrabbing = null;
    this.startPanelResize = null;
    this.panelX = 0;
    this.panelW = 0;
    this.maxValue = 0;
    this.lineLengthPreviewCanvas = 0;
    this.lineLength = (window.innerWidth / getDataMaxLength(this.data)) * devicePixelRatio * 4;
    this.classNamePrefix = "tgLineChart";
    this.disabledLines = [];
    this.init();
  }

  init() {
    this.appendNodes();
    this.resizeNodes();
    this.draw();
    this.setListeners();
  }

  draw() {
    const { nodes, lineLength, disabledLines, offset } = this;

    const {
      canvas: { node: canvas, backNode: canvasBackNode, lineWidth: canvasLineWidth },
      previewCanvas: { node: previewCanvas, backNode, lineWidth: previewLineWidth },
    } = nodes;
    const devicePixelRatio = window.devicePixelRatio;

    const data = this.data.filter(({ name }) => !disabledLines.some(s => s === name));

    const { width: canvasW, height: canvasH } = this.getWithHeigthByRatio(canvas);
    const { width: previewCanvasW, height: previewCanvasH } = this.getWithHeigthByRatio(
      previewCanvas,
    );
    this.panelW = this.getPanelWidth();
    this.lineLengthPreviewCanvas = getLineLength(data, previewCanvasW);
    this.panelX = previewCanvasW - this.panelW;
    const from = getDataMaxLength(data) - 1 - canvasW / lineLength;
    const to = getDataMaxLength(data);
    this.maxValue = getMaxValueFromTo({ data, from: Math.floor(from), to });
    const canvasBackNodeWidth =
      (to - 1) * lineLength * devicePixelRatio + offset.left + offset.right;
    canvasBackNode.setAttribute("width", canvasBackNodeWidth);
    const ctx = canvas.getContext("2d");

    data.forEach(item => {
      if (item.type === "line") {
        // preview canvas
        this.drawLine({
          width: canvasW,
          height: previewCanvasH,
          data: item,
          maxValue: getMaxValue(data),
          canvas: previewCanvas,
          lineLength: this.lineLengthPreviewCanvas,
          lineWidth: previewLineWidth,
        });

        // fake canvas
        this.drawLine({
          data: item,
          maxValue: getMaxValueFromTo({ data, from, to }),
          canvas: canvasBackNode,
          lineLength,
          lineWidth: canvasLineWidth,
          width: canvasBackNodeWidth,
          height: canvasH,
        });
      }
    });

    const x = from * lineLength;
    ctx.drawImage(canvasBackNode, -x, 0);
    const backCtx = backNode.getContext("2d");
    backCtx.drawImage(previewCanvas, 0, 0);
    this.fillPreviewCanvas(this.panelX, this.panelW);
  }

  redraw() {
    const { panelX, panelW, disabledLines, lineLength, nodes } = this;
    const {
      canvas: { node: canvas, backNode: canvasBackNode, lineWidth: canvasLineWidth },
      previewCanvas: {
        node: previewCanvas,
        backNode: previewBackNode,
        lineWidth: previewLineWidth,
      },
    } = nodes;

    const { height: canvasH } = this.getWithHeigthByRatio(canvas);
    const { width: previewCanvasW, height: previewCanvasH } = this.getWithHeigthByRatio(
      previewCanvas,
    );
    const ctx = canvas.getContext("2d");
    const data = this.data.filter(({ name }) => !disabledLines.some(s => s === name));
    const { from, to, canvasWidth } = this.getGrab(panelX);

    data.forEach(item => {
      if (item.type === "line") {
        // preview canvas
        this.drawLine({
          width: previewCanvasW,
          height: previewCanvasH,
          data: item,
          maxValue: getMaxValue(data),
          canvas: previewCanvas,
          lineLength: this.lineLengthPreviewCanvas,
          lineWidth: previewLineWidth,
        });

        // fake canvas
        this.drawLine({
          data: item,
          maxValue: getMaxValueFromTo({ data, from, to }),
          canvas: canvasBackNode,
          lineLength,
          lineWidth: canvasLineWidth,
          width: canvasWidth,
          height: canvasH,
        });
      }
    });

    const x = from * lineLength;
    ctx.drawImage(canvasBackNode, -x, 0);
    const backCtx = previewBackNode.getContext("2d");
    backCtx.drawImage(previewCanvas, 0, 0);
    this.fillPreviewCanvas(panelX, panelW);
  }

  getGrab(x) {
    const { nodes, lineLength, panelW, disabledLines, offset } = this;
    const data = this.data.filter(({ name }) => !disabledLines.some(s => s === name));
    const {
      previewCanvas: { node: previewCanvas },
    } = nodes;
    const { width: previewCanvasW } = this.getWithHeigthByRatio(previewCanvas);

    const devicePixelRatio = window.devicePixelRatio;
    const lines = getDataMaxLength(data) - 1;

    const canvasWidth = lines * lineLength * devicePixelRatio;
    const ratio = canvasWidth / previewCanvasW;
    const from = (x * ratio) / (lineLength * devicePixelRatio);
    const to = rateLimit(
      (x * ratio + panelW * ratio) / (lineLength * devicePixelRatio),
      0,
      lines + 1,
    );
    const maxValue = getMaxValueFromTo({ data, from, to });

    return {
      maxValue,
      from,
      to,
      ratio,
      canvasWidth: canvasWidth + offset.left + offset.right,
    };
  }

  getWithHeigthByRatio(node) {
    const { left = 0, right = 0 } = this.offset;

    const devicePixelRatio = window.devicePixelRatio;
    const { width: w, height: h } = node.getBoundingClientRect();

    return {
      width: w * devicePixelRatio - left * devicePixelRatio - right * devicePixelRatio,
      height: h * devicePixelRatio,
    };
  }

  drawLine({ data, maxValue, canvas, width, height, lineLength, lineWidth }) {
    const { offset } = this;
    const { values, color } = data;

    const { left } = offset;
    const devicePixelRatio = window.devicePixelRatio;

    const ctx = canvas.getContext("2d");

    let prevX = 0;
    let prevY = 0;

    for (let i = 0; i < values.length; i++) {
      ctx.lineCap = "round";
      const x =
        i !== 0
          ? lineLength * i + left * devicePixelRatio - (lineWidth / 2) * devicePixelRatio
          : left * devicePixelRatio + (lineWidth / 2) * devicePixelRatio;
      const y = height - (((values[i] * 100) / maxValue) * height) / 100;
      ctx.beginPath();
      if (i > 0) {
        ctx.moveTo(prevX, prevY);
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineTo(x, y);

      ctx.stroke();

      prevX = x;
      prevY = y;
    }
  }

  initControl({ name, color, chart }) {
    const { nodes } = this;
    const { container } = nodes;
    const label = document.createElement("label");
    const text = document.createElement("span");
    text.innerText = `graph ${chart}`;
    const icon = document.createElement("div");
    icon.classList.add(`${this.classNamePrefix}-checkmark-icon`);
    icon.style.borderColor = color;
    label.classList.add(`${this.classNamePrefix}-control`);
    const input = document.createElement("input");
    input.addEventListener("change", this.onChange.bind(this, name));
    label.appendChild(input);
    label.appendChild(icon);
    label.appendChild(text);
    input.setAttribute("type", "checkbox");
    input.setAttribute("checked", "checked");
    container.node.appendChild(label);
  }

  onChange(name) {
    this.clearAllCanvases();
    this.onDisabledLine(name);
    this.redraw();
  }

  clearAllCanvases() {
    const { nodes } = this;
    Object.keys(nodes).forEach(key => {
      const { node, backNode } = nodes[key];
      if (key !== "container") {
        this.clearCanvas(node);
        this.clearCanvas(backNode);
      }
    });
  }

  onDisabledLine(name) {
    const isDisabled = this.disabledLines.some(item => item === name);

    if (isDisabled) {
      this.disabledLines = this.disabledLines.filter(item => item !== name);
    } else {
      this.disabledLines.push(name);
    }
  }

  appendNodes() {
    const { data, nodes } = this;

    Object.keys(nodes).forEach((key, i, array) => {
      const { node } = nodes[key];
      node.classList.add(`${this.classNamePrefix}-${key}`);

      if (key !== "container") {
        const { node: container } = nodes[array[0]];
        container.appendChild(node);
      } else {
        this.root.appendChild(node);
      }
    });

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (item.type === "line") {
        this.initControl(item);
      }
    }
  }

  handleResize() {
    this.resizeNodes();
    this.draw();
  }

  resizeNodes() {
    const { nodes } = this;

    const devicePixelRatio = window.devicePixelRatio;
    const largePxRatio = devicePixelRatio > 1;

    Object.keys(nodes).forEach((key, i, array) => {
      const { node, height, backNode } = nodes[key];

      if (key !== "container") {
        const { node: container } = nodes[array[0]];
        const { width } = container.getBoundingClientRect();

        if (largePxRatio) {
          node.setAttribute("width", width * devicePixelRatio);
          node.setAttribute("height", height * devicePixelRatio);
          node.style.width = width + "px";
          node.style.height = height + "px";
        } else {
          node.setAttribute("width", width);
          node.setAttribute("height", height);
        }

        if (backNode) {
          if (largePxRatio) {
            backNode.setAttribute("width", width * devicePixelRatio);
            backNode.setAttribute("height", height * devicePixelRatio);
            backNode.style.width = width + "px";
            backNode.style.height = height + "px";
          } else {
            backNode.setAttribute("width", width);
            backNode.setAttribute("height", height);
          }
        }
      }
    });
  }

  setListeners() {
    document.addEventListener("mousemove", this.handleMove.bind(this));
    document.addEventListener("touchmove", this.handleMove.bind(this));
    document.addEventListener("mousedown", this.handleDown.bind(this));
    document.addEventListener("touchstart", this.handleDown.bind(this));
    document.addEventListener("mouseup", this.handleUp.bind(this));
    document.addEventListener("touchend", this.handleUp.bind(this));
    window.addEventListener("resize", this.handleResize.bind(this));
  }

  clearCanvas(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  getPanelWidth() {
    const { nodes, data, lineLength } = this;
    const { canvas, previewCanvas } = nodes;

    const { width: canvasWidth } = this.getWithHeigthByRatio(canvas.node);

    const { width: previewCanvasWidth } = this.getWithHeigthByRatio(previewCanvas.node);

    const lineLengthPreviewCanvas = getLineLength(data, previewCanvasWidth);

    const panelWidth = (canvasWidth / lineLength) * lineLengthPreviewCanvas;

    return panelWidth;
  }

  getPanelRect() {
    const { panelW, controlBorderWidth, nodes, offset, panelX } = this;
    const { previewCanvas } = nodes;
    const { left, right } = offset;

    const { height } = this.getWithHeigthByRatio(previewCanvas.node);

    return [
      panelX + controlBorderWidth + left,
      0,
      panelX + panelW - controlBorderWidth + right,
      height,
    ];
  }

  resizePanel(x, width) {
    const { startPanelResize, panelX, panelW } = this;
    const isRightBorder = startPanelResize > panelX + panelW;
    const positionX = x - startPanelResize;
    const opposite = isRightBorder ? positionX + panelW < 0 : panelW - positionX > 0;
    const rPanelX = positionX + panelW < 0 ? panelX + positionX + panelW : panelX;
    const lPanelX = panelW - positionX > 0 ? panelX + positionX : panelX + panelW;
    const panelXPos = isRightBorder ? rPanelX : lPanelX;
    const pW = isRightBorder ? Math.abs(positionX + panelW) : Math.abs(panelW - positionX);

    const limitWidth = opposite ? pW + rateLimit(panelXPos, 0) : width - rateLimit(panelXPos, 0);

    return {
      pX: rateLimit(panelXPos, 0),
      pW: panelXPos > 0 ? rateLimit(pW, 0, limitWidth) : rateLimit(pW + panelXPos, 0, limitWidth),
    };
  }

  handleMove(e) {
    const {
      data,
      nodes,
      startPanelGrabbing,
      panelX,
      panelW,
      maxValue,
      disabledLines,
      lineLength,
      startPanelResize,
    } = this;
    const { previewCanvas } = nodes;
    const {
      canvas: { node: canvas, backNode: canvasBackNode, lineWidth },
    } = nodes;
    const { move, leftBorder, rightBorder } = this.insidePanel(e);
    const isNotAction = startPanelGrabbing === null && startPanelResize === null;
    const devicePixelRatio = window.devicePixelRatio;
    const { x } = getPosition(e, devicePixelRatio);
    const { width } = this.getWithHeigthByRatio(previewCanvas.node);

    if (isNotAction && move) {
      previewCanvas.node.style.cursor = "grab";
    } else if (isNotAction && (leftBorder || rightBorder)) {
      previewCanvas.node.style.cursor = "col-resize";
    } else if (isNumeric(startPanelResize)) {
      // panel resize
      const { pX, pW } = this.resizePanel(x, width);

      this.clearCanvas(previewCanvas.node);
      const ctxPreview = previewCanvas.node.getContext("2d");
      ctxPreview.drawImage(previewCanvas.backNode, 0, 0);
      this.fillPreviewCanvas(pX, pW);
    } else if (isNumeric(startPanelGrabbing)) {
      // panel grab

      const { height: canvasH } = this.getWithHeigthByRatio(canvas);
      const positionX = x - startPanelGrabbing;
      const nextX = rateLimit(panelX + positionX, 0, width - panelW);

      this.clearCanvas(previewCanvas.node);
      const ctxPreview = previewCanvas.node.getContext("2d");
      ctxPreview.drawImage(previewCanvas.backNode, 0, 0);
      this.fillPreviewCanvas(nextX, panelW);

      const { maxValue: nextMaxValue, ratio, canvasWidth } = this.getGrab(nextX);

      if (maxValue !== nextMaxValue) {
        this.maxValue = nextMaxValue;
        this.clearCanvas(canvasBackNode);

        const filteredData = data.filter(({ name }) => !disabledLines.some(s => s === name));

        filteredData.forEach(item => {
          if (item.type === "line") {
            this.drawLine({
              data: item,
              maxValue: nextMaxValue,
              canvas: canvasBackNode,
              lineLength,
              lineWidth,
              width: canvasWidth,
              height: canvasH,
            });
          }
        });
      }

      const ctx = canvas.getContext("2d");
      this.clearCanvas(canvas);
      ctx.drawImage(canvasBackNode, (-nextX * ratio) / devicePixelRatio, 0);
    } else if (isNotAction) {
      previewCanvas.node.style.cursor = "default";
    }
  }

  handleUp(e) {
    const { nodes, startPanelGrabbing, startPanelResize, panelX } = this;
    const { previewCanvas } = nodes;
    const devicePixelRatio = window.devicePixelRatio;
    const { x } = getPosition(e, devicePixelRatio);
    const { width } = this.getWithHeigthByRatio(previewCanvas.node);

    if (isNumeric(startPanelGrabbing)) {
      const positionX = x - startPanelGrabbing;
      this.panelX = rateLimit(panelX + positionX, 0, width - this.panelW);

      this.startPanelGrabbing = null;
      document.documentElement.style.cursor = "";
    } else if (isNumeric(startPanelResize)) {
      console.info("--> ggwp no re 4444", this.resizePanel(x, width));

      document.documentElement.style.cursor = "";
      this.startPanelResize = null;
    }

    const { move, leftBorder, rightBorder } = this.insidePanel(e);

    if (move) {
      previewCanvas.node.style.cursor = "grab";
    } else if (leftBorder || rightBorder) {
      previewCanvas.node.style.cursor = "col-resize";
    } else {
      previewCanvas.node.style.cursor = "default";
    }
  }

  handleDown(e) {
    const { previewCanvas } = this.nodes;
    const { x } = getPosition(e);
    const { move, leftBorder, rightBorder } = this.insidePanel(e);
    const devicePixelRatio = window.devicePixelRatio;

    if (move) {
      this.startPanelGrabbing = x * devicePixelRatio;
      document.documentElement.style.cursor = "grabbing";
      previewCanvas.node.style.cursor = "grabbing";
    } else if (leftBorder || rightBorder) {
      this.startPanelResize = x * devicePixelRatio;
      document.documentElement.style.cursor = "col-resize";
      previewCanvas.node.style.cursor = "col-resize";
    }
  }

  insidePanel(e) {
    const { controlBorderWidth } = this;
    const devicePixelRatio = window.devicePixelRatio;
    const { x, y } = getPosition(e, devicePixelRatio);
    const panelReact = this.getPanelRect();
    const [xMin, yMin, xMax, yMax] = panelReact;

    const leftBorderRect = [
      xMin - controlBorderWidth * devicePixelRatio,
      yMin,
      xMin + controlBorderWidth * devicePixelRatio,
      yMax,
    ];
    const rightBorderRect = [xMax, yMin, xMax + controlBorderWidth * devicePixelRatio, yMax];

    return {
      leftBorder: isDotInsideRect([x, y], leftBorderRect),
      rightBorder: isDotInsideRect([x, y], rightBorderRect),
      move: isDotInsideRect([x, y], panelReact),
    };
  }

  fillPreviewCanvas(x, panelWidth) {
    const { nodes, controlBorderWidth, offset } = this;
    const {
      previewCanvas: { node: previewCanvas },
    } = nodes;
    const { left } = offset;
    const devicePixelRatio = window.devicePixelRatio;

    const { width, height } = this.getWithHeigthByRatio(previewCanvas);

    const ctx = previewCanvas.getContext("2d");

    ctx.beginPath();
    ctx.fillStyle = hexToRGB("#F4F9FC", 0.76);

    // before
    ctx.rect(left * devicePixelRatio, 0, x, height);
    ctx.fill();

    ctx.beginPath();
    // after
    ctx.rect(x + panelWidth + left * devicePixelRatio, 0, width - x - panelWidth, height);
    ctx.fill();

    // center
    ctx.beginPath();
    ctx.lineWidth = controlBorderWidth;
    ctx.strokeStyle = "rgba(0,0,0, 0.14)";
    ctx.rect(
      x + left * devicePixelRatio + controlBorderWidth / 2,
      0,
      panelWidth - controlBorderWidth,
      height,
    );
    ctx.stroke();
  }

  destroy() {
    const {
      container: { node },
    } = this.nodes;
    node.remove();
  }
}
