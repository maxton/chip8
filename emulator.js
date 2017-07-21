'use strict';

class FileDropper {
  constructor(el, handler) {
    el.addEventListener("dragover",this.handleDragOver);
    el.addEventListener("drop", this.handleDrop.bind(this));
    this.files = [];
    this.handler = handler;
  }
  
  handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy';
  }
  /**
   * 
   * @param {DragEvent} evt 
   */
  handleDrop(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    this.loadFile(evt.dataTransfer.files);
  }
  /**
   * 
   * @param {FileList} files 
   */
  loadFile(files) {
    var f = files[0];
    var reader = new FileReader();
    console.log("Loading "+f.name);
    reader.onload = ((e) => {
      this.handler(e.target.result);
    }).bind(this);
    reader.readAsArrayBuffer(f);
  }
}

class Emulator {
    /**
     * 
     * @param {HTMLCanvasElement} canvas 
     */
    constructor(canvas) {
        let ctx = canvas.getContext("2d");
        let self = this;
        let IO = {
            cls() {
                ctx.fillStyle = "#000";
                ctx.fillRect(0,0,64,64);
            },
            onKey(fun) {
                const keyMap = {
                    88 : 0, 49 : 1, 50 : 2, 51 : 3,
                    81 : 4, 87 : 5, 69 : 6, 65 : 7,
                    83 : 8, 68 : 9, 90: 10, 67: 11,
                    52: 12, 82: 13, 70: 14, 86: 15
                }
                document.addEventListener("keydown", (e) =>{
                    const key = keyMap[e.keyCode];
                    if (key != undefined)
                        fun(key, true);
                })
                document.addEventListener("keyup", (e) => {
                    const key = keyMap[e.keyCode];
                    if (key != undefined)
                        fun(key, false);
                })
            },
            onTick(fun) {
                self.tickFun = fun;
            },
            display(pixels) {
                for(var i = 0; i < 4096; i++) {
                    const pixel = pixels[i];
                    ctx.fillStyle = pixel ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
                    ctx.fillRect(i%64,i/64|0,1,1);
                }
            },
        }
        this.tickFun = () => {}
        this.CPU = new CPU(IO);
        this.tick = this.tick.bind(this);
        this.render = this.render.bind(this);
        this.running = false;
        this.speed = 10;
        this.ROM = [];
    }

    tick() {
        this.tickFun();
    }

    render() {
        if(this.running) {
            const cycles = this.speed;
            try {
                for(var i = 0; i < cycles; i++)
                    this.CPU.step();
                this.CPU.updateDisplay();
                window.requestAnimationFrame(this.render);
            } catch (ex) {
                console.log("Error: "+ex);
                this.stop();
            }
        }
    }

    run () {
        if(!this.running) {
            this.running = true;
            this.interval = setInterval(this.tick, 1000/60);
            window.requestAnimationFrame(this.render);
        }
    }

    stop () {
        if(this.running) {
            this.running = false;
            clearInterval(this.interval);
        }
    }

    softReset() {
        this.stop();
        this.CPU.loadROM(this.ROM);
        this.run();
    }

    loadROM (bytes) {
        this.ROM = bytes;
        this.softReset();
    }
}