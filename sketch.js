/*      NEEDS WORK
    Factor out the block deletion code so it can be called seperatley when appropriate. Work on tightening creation controls.
*/
let blockColors;
let blocks = [];

let people = [];
let maxPeople = 1;

let camFeed;
let video;
let bodies = [];

function preload() {
  camFeed = ml5.bodyPose();
}

function setup() {
  createCanvas(800, 600);
  background(255);

  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  // Start body pose detection
  camFeed.detectStart(video, bodyCheck);

  blockColors = [
    color(255, 0, 0),    // Red
    color(0, 255, 0),    // Green
    color(0, 0, 255),    // Blue
    color(255, 255, 0),  // Yellow
    color(255, 0, 255),  // Purple
    color(0, 255, 255),  // Teal
    color(128, 0, 255),  // Indigo
    color(0, 128, 255),  // Sky Blue
    color(128, 128, 255),  // Periwinkle
    color(255, 128, 0),  // Orange
    color(255, 0, 128),  // Fuscia
    color(255, 128, 128),  // Pink
    color(0, 255, 128),   // sage
    color(128, 255, 0),   // lime
    color(128, 255, 128)   // mint
  ];

  // Disable right-click on the canvas
  for (let element of document.getElementsByClassName("p5Canvas")) {
    element.addEventListener("contextmenu", (e) => e.preventDefault());
  }
}

function draw() {
  background(255);
  if (blocks.length != 0) {
    for (let c = 0; c < blocks.length; c++) {
      blocks[c].display();
    }
  }
  if (bodies.length > 0) {
    drawBodies();
  }
}

function drawBodies() {
  for (let i = 0; i < bodies.length; i++) {
    let body = bodies[i];

    // Track and assign colors based on ID
    let person = findPersonById(body.id);
    if (!person) {
      // Add a new person if not found
      person = new Person(body.id);
      people.push(person);
    }

    // Draw a circle with the person's color (or a generic color if needed)
    fill(person.color);
    noStroke();
    circle(body.keypoints[0].x, body.keypoints[0].y, 30);
    circle(body.keypoints[10].x, body.keypoints[10].y, 20);
    circle(body.keypoints[9].x, body.keypoints[9].y, 20);

    if (body.keypoints[9].x > body.keypoints[10].x - 100 && body.keypoints[9].x < body.keypoints[10].x + 100 && body.keypoints[9].y > body.keypoints[10].y - 100 && body.keypoints[9].y < body.keypoints[10].x + 100) {
      drawBlocks(body.keypoints[9].x, body.keypoints[9].y, person.color);
      console.log("Draw a block");
    }
  }
}

function bodyCheck(results) {
  bodies = results;

  // Check for removed people (people who are no longer tracked)
  let trackedIds = bodies.map(body => body.id);
  people = people.filter(person => trackedIds.includes(person.id));
}

function mousePressed() {
  let randCol = random(blockColors);
  drawBlocks(mouseX, mouseY, randCol);
}

function drawBlocks(xLoc, yLoc, blColor) {
  let blockDetect = false;

  for (let i = 0; i < blocks.length; i++) {
    blockDetect = blocks[i].overlaps(xLoc, yLoc, 10);
    if (blockDetect) {
      if (mouseButton === RIGHT) {
        blocks.splice(i, 1);
      }
      break;
    }
  }

  if (!blockDetect) {
    blocks.push(new Block(xLoc, yLoc, blColor, 25, 25));
  }
}

function mouseDragged() {
  let randCol = random(blockColors);
  drawBlocks(mouseX, mouseY, randCol);
}


class Block {
  constructor(posX, posY, blockCol, blockW, blockH) {
    this.x = posX;
    this.y = posY;
    this.color = blockCol;
    this.width = blockW;
    this.height = blockH;
  }

  display() {
    push();
    fill(this.color);
    rect(this.x, this.y, this.width, this.height);
    pop();
  }

  overlaps(testX, testY, testSize) {
    if (testX + testSize <= this.x + this.width && testX - testSize >= this.x && testY + testSize <= this.y + this.height && testY - testSize >= this.y) {
      return true;
    }
    return false;
  }
}

class Person {
  constructor(bodyID) {
    this.id = bodyID;
    this.color = random(blockColors);
  }
}

// Helper function to find a person by ID
function findPersonById(id) {
  return people.find(person => person.id === id);
}
