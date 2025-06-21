{
const revealTray = document.getElementById('reveal-tray');
const tileTray = document.getElementById('tile-tray');

new Sortable(tileTray, {
    group: 'shared',
    animation: 150,
    onMove: function (evt, originalEvent) {
        
        // Prevent move if reveal-tray already has 7 or more items
        if (revealTray.children.length >= 7 && evt.to === revealTray) {
            return false; // Cancel move before it happens
        }
    }
});

new Sortable(revealTray, {
    group: 'shared',
    animation: 150,
});

// Add click-to-move behavior
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('tile')) {
        const item = e.target;
        const parent = item.parentElement;

        if (parent === tileTray && revealTray.children.length < 7) {
            revealTray.appendChild(item); 
        } else if (parent === revealTray) {
            tileTray.appendChild(item); 
        }
    }
});
}