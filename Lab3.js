function processImage(inImg) {
  const width = inImg.width;
  const height = inImg.height;
  const src = new Uint32Array(inImg.data.buffer);
  
  processCanvas('canvasResult', width, height, function(dst) {
    let brightness = parseInt($("#rangeBrightness").val());
    let contrast = parseInt($("#rangeContrast").val()) / 255;
    
    let avgGray = 0;
    for (let i = 0; i < dst.length; i++) {
      let r = src[i] & 0xFF;
      let g = (src[i] >> 8) & 0xFF;
      let b = (src[i] >> 16) & 0xFF;
      avgGray += (r * 0.2126 + g * 0.7152 + b * 0.0722);
    }
    avgGray /= dst.length;
    
    for (let i = 0; i < dst.length; i++) {
      let r = src[i] & 0xFF;
      let g = (src[i] >> 8) & 0xFF;
      let b = (src[i] >> 16) & 0xFF;
      
      // Contrast
      r += (r - avgGray) * contrast;
      g += (g - avgGray) * contrast;
      b += (b - avgGray) * contrast;
      // Brightness
      r += brightness;
      g += brightness;
      b += brightness;
      
      if (r > 255) r = 255;
      else if (r < 0) r = 0;
      if (g > 255) g = 255;
      else if (g < 0) g = 0;
      if (b > 255) b = 255;
      else if (b < 0) b = 0;
      
      dst[i] = (src[i] & 0xFF000000) | (b << 16) | (g << 8) | r;
    }
    
    // Histogram
    let histBrightness = (new Array(256)).fill(0);
    for (let i = 0; i < dst.length; i++) {
      let r = dst[i] & 0xFF;
      let g = (dst[i] >> 8) & 0xFF;
      let b = (dst[i] >> 16) & 0xFF;
      histBrightness[r]++;
      histBrightness[g]++;
      histBrightness[b]++;
    }

    let maxBrightness = 0;
    for (let i = 1; i < 256; i++) {
      if (maxBrightness < histBrightness[i]) {
        maxBrightness = histBrightness[i]
      }
    }

    const canvas = document.getElementById('canvasHistogram');
    const ctx = canvas.getContext('2d');
    let dx = canvas.width / 256;
    let dy = canvas.height / maxBrightness;
    ctx.lineWidth = dx;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 256; i++) {
      let x = i * dx;
      ctx.strokeStyle = "#000000";
      ctx.beginPath();
      ctx.moveTo(x, canvas.height);
      ctx.lineTo(x, canvas.height - histBrightness[i] * dy);
      ctx.closePath();
      ctx.stroke(); 
    }
  });
  
  processCanvas('canvasConvolutionMatrix', width, height, function(dst) {
    const kernelSize = 3;
    const halfSize = Math.floor(kernelSize / 2);
    // Fill kernel
    let kernel = new Array(kernelSize);
    for (let y = 0; y < kernelSize; y++) {
      kernel[y] = new Array(kernelSize).fill(0);
      for (let x = 0; x < kernelSize; x++) {
        const inputId = "#kernel" + (y + 1) + "" + (x + 1);
        kernel[y][x] = parseFloat($(inputId).val()) || 0;
      }
    }
    let div = parseFloat($('#div').val()) || 1;
    if (div <= 0.0) {
      div = 1.0;
    }
    let offset =0/* parseInt($('#offset').val()) || 0*/;
    
    let dstIndex = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0;
        for (let sy = 0; sy < kernelSize; sy++) {
          const yy = Math.min(height - 1, Math.max(0, y + sy - halfSize));
          for (let sx = 0; sx < kernelSize; sx++) {
            const xx = Math.min(width - 1, Math.max(0, x + sx - halfSize));
            let pix = src[yy * width + xx];
            
            r += (pix & 0xFF) * kernel[sy][sx];
            g += ((pix >> 8) & 0xFF) * kernel[sy][sx];
            b += ((pix >> 16) & 0xFF) * kernel[sy][sx];
          }
        }
        
        const a = src[y * width + x] & 0xFF000000;
        r = Math.min(255, Math.max(0, offset + (r / div))) & 0xFF;
        g = Math.min(255, Math.max(0, offset + (g / div))) & 0xFF;
        b = Math.min(255, Math.max(0, offset + (b / div))) & 0xFF;
        
        dst[dstIndex++] = a | (b << 16) | (g << 8) | r;
      }
    }
  });


  
  
}

function getImageData(el) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const img = document.getElementById(el);
  canvas.width = img.width;
  canvas.height = img.height;
  context.drawImage(img, 0, 0);
  return context.getImageData(0, 0, img.width, img.height);
}

function processCanvas(canvasId, width, height, func) {
  const canvas = document.getElementById(canvasId);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const outImg = ctx.createImageData(width, height);
  const dst = new Uint32Array(outImg.data.buffer);
  func(dst);
  ctx.putImageData(outImg, 0, 0);
}

document.getElementById('input').addEventListener('change', function() {
  if (this.files && this.files[0]) {
    var img = document.getElementById('img');
    img.src = URL.createObjectURL(this.files[0]);
    img.onload = update;
  }
});
$('#presets').on('change', function(e) {
  const values = $(this).val().split(' ');
  const size = Math.sqrt(values.length - 2) >> 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      $('#kernel' + (y + 1) + "" + (x + 1)).val(values[y * size + x]);
    }
  }
  $('#div').val(values[values.length - 2]);
  //$('#offset').val(values[values.length - 1]);
  update();
});

$('input[type="text"]').on('change', update);

$('input[type="range"]').on('input change', update);

function update(e) {
  $('#valueBrightness').text($("#rangeBrightness").val());
  $('#valueContrast').text($("#rangeContrast").val());
  processImage(getImageData('img'));
}

update();


//Эквализация
function fun1() {
var chbox;
chbox=document.getElementById('Equalization');
	if (chbox.checked) {
	const InImg=getImageData('canvasResult');
  const Width = InImg.width;
  const Height = InImg.height;
  const Src = new Uint32Array(InImg.data.buffer);
    let HistBrightness = (new Array(256)).fill(0);
    for (let i = 0; i < Src.length; i++) {
      let r = Src[i] & 0xFF;
      let g = (Src[i] >> 8) & 0xFF;
      let b = (Src[i] >> 16) & 0xFF;
      HistBrightness[r]++;
      HistBrightness[g]++;
      HistBrightness[b]++;
      
      
    }
    
    let MaxBrightness = 0;
    let MinBrightness = 0;
    for (let i = 1; i < 256; i++) {
      if (MaxBrightness < HistBrightness[i]) {
        MaxBrightness = HistBrightness[i]
      }
      
      if (MinBrightness > HistBrightness[i]) {
        MinBrightness = HistBrightness[i]
      }
    }
    let n=Width* Height;
     let cdf = (new Array(256)).fill(0);
    cdf[0]=HistBrightness[0];
    //alert(HistBrightness[200]);
    for (let i = 1; i < 256; i++)
    {
      cdf[i]=cdf[i-1]+HistBrightness[i];
    }
    
    let cdfmin = 1;
    let cdfmax = 0;
    for (let i = 0; i < 256; i++)
    {
      if (cdfmax < cdf[i]) {
        cdfmax = cdf[i];
      }
  
      if (cdfmin > cdf[i] && cdf[i]>0) {
        cdfmin = cdf[i];
      }
    }
    
   // alert(cdfmin);
  let L=256;
      let h = (new Array(256)).fill(0);
      for (let i = 0; i < 256; i++)
        {
          h[i]=Math.round((cdf[i]-cdfmin)/(n-1)*(L-1));
          
        }
    /*alert(HistBrightness[100]);
    alert(h[100]);*/  
    
    let max_h=0;
    let min_h=0;
     for (let i = 0; i < 256; i++)
    {
      if (max_h < h[i]) {
        max_h = h[i];
      }
  
      if (min_h > h[i]) {
        min_h = h[i];
      }
    }
       
   // alert(h[140]);
    const Canvas = document.getElementById('canvasHistogram');
    const Ctx = Canvas.getContext('2d');
    let Dx = Canvas.width / 256;
    let Dy = Canvas.height / MaxBrightness;
    Ctx.lineWidth = Dx;
    Ctx.fillStyle = "#fff";
    Ctx.fillRect(0, 0, Canvas.width, Canvas.height);

    for (let i = 0; i < 256; i++) {
      let X = i * Dx;
      Ctx.strokeStyle = "#000000";
      Ctx.beginPath();
      Ctx.moveTo(X, Canvas.height);
      Ctx.lineTo(X, Canvas.height - h[i] * Dy);
      Ctx.closePath();
      Ctx.stroke(); 
    }
	}
	else {
		processImage(getImageData('img'));
	}
}

function fun2()
{
  var Chbox;
Chbox=document.getElementById('LinearContrast');
	if (Chbox.checked)
  {
  const canvas= document.getElementById('canvasResult');
  const ctx = canvas.getContext('2d');
	const InImg=getImageData('canvasResult');
  const Width = InImg.width;
  const Height = InImg.height;
  const outImg = ctx.createImageData(Width, Height);
  const Src = new Uint32Array(InImg.data.buffer);
  const dst = new Uint32Array(outImg.data.buffer);
    let Gray = (new Array(256)).fill(0);
    for (let i = 0; i < Src.length; i++) 
    {
      let r = Src[i] & 0xFF;
      let g = (Src[i] >> 8) & 0xFF;
      let b = (Src[i] >> 16) & 0xFF;
      Gray[i]= (r * 0.2126 + g * 0.7152 + b * 0.0722);

    }
    let min_Gray=0;
    let max_Gray=0
    
    for (let i = 1; i < 256; i++) {
      if (max_Gray <Gray[i]) {
        max_Gray =Gray[i];
      }
      
      if (min_Gray > Gray[i]) {
       max_Gray =Gray[i];
      }
    }
    //alert(min_Gray);
    //alert(max_Gray);
    
     for (let i = 1; i <Src.length; i++){
      let r = Src[i] & 0xFF;
      let g = (Src[i] >> 8) & 0xFF;
      let b = (Src[i] >> 16) & 0xFF;
      r += (r - 126) *(256/(max_Gray-min_Gray));
      g += (g -126) *(256/(max_Gray-min_Gray)) ;
      b += (b - 126) * (256/(max_Gray-min_Gray));
      // Brightness
   
      
      if (r > 255) r = 255;
      else if (r < 0) r = 0;
      if (g > 255) g = 255;
      else if (g < 0) g = 0;
      if (b > 255) b = 255;
      else if (b < 0) b = 0;
      
      dst[i] = (Src[i] & 0xFF000000) | (b << 16) | (g << 8) | r;
    
     }
    ctx.putImageData(outImg, 0, 0);
    
  }
  else
    {
      processImage(getImageData('img'));
    }
}


