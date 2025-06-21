{
const chatModal = document.getElementById("chat-modal");
const chatOpen = document.getElementById("chat-btn");
const chatClose = document.getElementById("chat-close");
const notifDot = document.getElementById("notification-dot");

chatOpen.onclick = function() {
    chatModal.classList.remove('disabled');
    notifDot.classList.add('disabled');
}

chatClose.onclick = function() {
    chatModal.classList.add('disabled');
}

const helpModal = document.getElementById("help-modal");
const helpOpen = document.getElementById("help-btn");
const helpClose = document.getElementById("help-close");

helpOpen.onclick = function() {
    helpModal.classList.remove('disabled');
}

helpClose.onclick = function() {
    helpModal.classList.add('disabled');
}

const categorySelect = document.getElementById("category-select");
let randomOption = document.createElement("option");
randomOption.value = "random";
randomOption.text = "Random category";
categorySelect.appendChild(randomOption);
for (let catName in categories) {
    let option = document.createElement("option");
    option.value = catName;
    option.text = categories[catName].label;
    categorySelect.appendChild(option);
}

const winCategorySelect = document.getElementById("win-category-select");
let randomOption2 = document.createElement("option");
randomOption2.value = "random";
randomOption2.text = "Random category";
winCategorySelect.appendChild(randomOption2);
for (let catName in categories) {
    let option = document.createElement("option");
    option.value = catName;
    option.text = categories[catName].label;
    winCategorySelect.appendChild(option);
}
}