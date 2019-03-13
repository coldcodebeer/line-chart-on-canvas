class LineChart {
  constructor({ root, data }) {
    this.data = normalizeData(data);
    this.root = root;

    this.nodes = {
      container: {
        node: document.createElement("div"),
      },
      canvas: {
        node: document.createElement("canvas"),
        height: 440,
        padding: {
          left: 20,
          right: 20,
        },
      },
      previewCanvas: {
        node: document.createElement("canvas"),
        height: 54,
        padding: {
          left: 20,
          right: 20,
        },
      },
    };

    this.lineLength = window.innerWidth / (getDataMaxLength(this.data) / 4);
    this.classNamePrefix = "tgLineChart";
    this.init();
  }

  controlBorderWidth = 5;
  startPanelGrabbing = null;
  panelX = 0;
  panelW = 0;

  init() {
    const { nodes, data, lineLength } = this;
    const {
      canvas,
      previewCanvas: { node: previewCanvas, padding },
    } = nodes;
    const { left, right } = padding;

    Object.keys(nodes).forEach((key, i, array) => {
      const { node, height } = nodes[key];

      node.classList.add(`${this.classNamePrefix}-${key}`);
      if (i > 0) {
        const { node: container } = nodes[array[0]];

        const { width } = container.getBoundingClientRect();
        node.setAttribute("width", width);
        if (height) {
          node.setAttribute("height", height);
        }
        container.appendChild(node);
      } else {
        this.root.appendChild(node);
      }
    });

    const max = getMaxValue(data);
    const previewCanvasWidth = previewCanvas.getBoundingClientRect().width - left - right;

    this.panelW = this.getPanelWidthFromLineLength();

    this.panelX = previewCanvasWidth - this.panelW;

    this.fillPreviewCanvas(previewCanvasWidth - this.panelW, this.panelW);

    const lineLengthPreviewCanvas = getLineLength(data, previewCanvasWidth);

    data.forEach(item => {
      if (item.type === "line") {
        // main canvas
        this.drawLine({ data: item, max, canvas, lineLength });

        // preview canvas
        this.drawLine({
          data: item,
          max,
          canvas: nodes.previewCanvas,
          lineLength: lineLengthPreviewCanvas,
          alpha: 0.24,
        });
      }
    });

    window.addEventListener("mousemove", this.handleMove.bind(this));
    window.addEventListener("mousedown", this.handleDown.bind(this));
    window.addEventListener("mouseup", this.handleUp.bind(this));
  }

  getPanelWidthFromLineLength() {
    const { nodes, data, lineLength } = this;
    const { canvas, previewCanvas } = nodes;

    const previewCanvasWidth =
      previewCanvas.node.getBoundingClientRect().width -
      previewCanvas.padding.left -
      previewCanvas.padding.right;
    const canvasWidth =
      canvas.node.getBoundingClientRect().width - canvas.padding.left - canvas.padding.right;
    const lineLengthPreviewCanvas = getLineLength(data, previewCanvasWidth);

    const panelWidth = (canvasWidth / lineLength) * lineLengthPreviewCanvas;

    return panelWidth;
  }

  getPanelRect() {
    const { panelX, panelW, controlBorderWidth, nodes } = this;
    const {
      previewCanvas: { height, padding },
    } = nodes;
    const { left, right } = padding;

    return [
      panelX + controlBorderWidth + left,
      0,
      panelX + panelW - controlBorderWidth + right,
      height,
    ];
  }

  handleUp(e) {
    const { nodes } = this;
    const { previewCanvas } = nodes;

    this.startPanelGrabbing = null;
    document.body.style.cursor = "";

    const insidePanel = this.insidePanel(e);

    if (insidePanel) {
      previewCanvas.node.style.cursor = "grab";
    } else {
      previewCanvas.node.style.cursor = "default";
    }
  }

  handleDown(e) {
    const { previewCanvas } = this.nodes;
    const { x } = getPosition(e);

    this.startPanelGrabbing = x;

    const insidePanel = this.insidePanel(e);

    if (insidePanel) {
      document.body.style.cursor = "grabbing";
      previewCanvas.node.style.cursor = "grabbing";
    }
  }

  insidePanel(e) {
    const { x, y } = getPosition(e);
    const panelReact = this.getPanelRect();

    return isDotInsideRect([x, y], panelReact);
  }

  handleMove(e) {
    const { nodes, startPanelGrabbing } = this;
    const { previewCanvas } = nodes;

    const insidePanel = this.insidePanel(e);

    if (startPanelGrabbing === null) {
      if (insidePanel) {
        previewCanvas.node.style.cursor = "grab";
      } else {
        previewCanvas.node.style.cursor = "default";
      }
    }
  }

  drawLine({ data, max, canvas, lineLength, alpha }) {
    const { values, color } = data;
    const { node, padding } = canvas;
    const { left = 0 } = padding;

    const { height } = node.getBoundingClientRect();
    const ctx = node.getContext("2d");

    let prevX = 0;
    let prevY = 0;

    values.forEach((value, i) => {
      ctx.beginPath();

      if (i > 0) {
        ctx.moveTo(prevX, prevY);
      }

      const x = i !== 0 ? lineLength * i - 0.5 + left : 0 + left;
      const y = height - (((value * 100) / max) * height) / 100 - 0.5;

      if (alpha) {
        ctx.strokeStyle = hexToRGB(color, alpha);
      } else {
        ctx.strokeStyle = color;
      }

      ctx.lineWidth = 2;
      ctx.lineTo(x, y);
      ctx.stroke();
      prevX = x;
      prevY = y;
    });
  }

  fillPreviewCanvas(x, panelWidth) {
    const { nodes, controlBorderWidth } = this;
    const {
      previewCanvas: { node: previewCanvas, padding },
    } = nodes;
    const { left, right } = padding;

    const { width, height } = previewCanvas.getBoundingClientRect();
    const ctx = previewCanvas.getContext("2d");

    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    ctx.fillStyle = "#F4F9FC";

    // before
    ctx.rect(left, 0, x, height);
    ctx.fill();

    ctx.beginPath();
    // after
    ctx.rect(x + panelWidth + left, 0, width - left - right - x - panelWidth, height);
    ctx.fill();

    // center
    ctx.beginPath();
    ctx.lineWidth = controlBorderWidth;
    ctx.strokeStyle = "rgba(0,0,0, 0.14)";
    ctx.rect(x + left + controlBorderWidth / 2, 0, panelWidth - controlBorderWidth, height);
    ctx.stroke();
  }

  destroy() {
    const {
      container: { node },
    } = this.nodes;
    node.remove();
  }
}
