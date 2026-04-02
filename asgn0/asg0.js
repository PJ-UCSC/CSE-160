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

  ctx.strokeStyle = 'red';

  ctx.beginPath();
  ctx.moveTo(center_x, center_y);
  ctx.lineTo(center_x + 75, center_y + 50);
  ctx.stroke();
}
