// DrawTriangle.js (c) 2012 matsuda
function main() {  
  // Retrieve <canvas> element
  var canvas = document.getElementById('canvas');  
  if (!canvas) { 
    console.log('Failed to retrieve the <canvas> element');
    return false; 
  } 

  // Get the rendering context for 2DCG
  var ctx = canvas.getContext('2d');

  // Draw a black rectangle
  ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';                   // Set color to black
  ctx.fillRect(0, 0, canvas.width, canvas.height);        // Fill a rectangle with the color

  handleDrawEvent();
}

function handleDrawEvent() {
  let center_x = canvas.width / 2;
  let center_y = canvas.height / 2;
  var ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let x1_offset = parseFloat(document.getElementById('x1-coord').value) * 20;
  let y1_offset = parseFloat(document.getElementById('y1-coord').value) * 20;

  let x2_offset = parseFloat(document.getElementById('x2-coord').value) * 20;
  let y2_offset = parseFloat(document.getElementById('y2-coord').value) * 20;

  let operation = document.getElementById('operation').value;

  ctx.beginPath();
  ctx.strokeStyle = 'red';
  ctx.moveTo(center_x, center_y);
  ctx.lineTo(center_x + x1_offset, center_y - y1_offset);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = 'blue';
  ctx.moveTo(center_x, center_y);
  ctx.lineTo(center_x + x2_offset, center_y - y2_offset);
  ctx.stroke();

  if (operation != 'none') {
    if (operation == 'add') {
      ctx.beginPath();
      ctx.strokeStyle = 'green';
      ctx.moveTo(center_x, center_y);
      ctx.lineTo(center_x + (x1_offset + x2_offset), center_y - (y1_offset + y2_offset));
      ctx.stroke();
    } else if (operation == 'sub') {
      ctx.beginPath();
      ctx.strokeStyle = 'green';
      ctx.moveTo(center_x, center_y);
      ctx.lineTo(center_x + (x1_offset - x2_offset), center_y - (y1_offset - y2_offset));
      ctx.stroke();
    } else if ((operation == 'mul' || operation == 'div') && document.getElementById('scalar').value != "") {
      console.log('Multiplication or Division Operation');
      let scalar = parseFloat(document.getElementById('scalar').value);
      if (operation == 'mul') {
        ctx.beginPath();
        ctx.strokeStyle = 'green';
        ctx.moveTo(center_x, center_y);
        ctx.lineTo(center_x + x1_offset*scalar, center_y - y1_offset*scalar);
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = 'green';
        ctx.moveTo(center_x, center_y);
        ctx.lineTo(center_x + x2_offset*scalar, center_y - y2_offset*scalar);
        ctx.stroke();
      } else if (operation == 'div') {
        if (scalar == 0) {
          alert("Error: Please enter a non-zero scalar value if you want to perform division");
          return;
        }
        ctx.beginPath();
        ctx.strokeStyle = 'green';
        ctx.moveTo(center_x, center_y);
        ctx.lineTo(center_x + x1_offset/scalar, center_y - y1_offset/scalar);
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = 'green';
        ctx.moveTo(center_x, center_y);
        ctx.lineTo(center_x + x2_offset/scalar, center_y - y2_offset/scalar);
        ctx.stroke();
      }
    } else if ((operation == 'mul' || operation == 'div') && document.getElementById('scalar').value == "") {
      alert("Error: Please enter a scalar value if you want to perform multiplication or division");
    }
  }
}
