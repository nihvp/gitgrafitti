// Hey there! We wait for the entire HTML document to load before running our script
// to ensure we don't try to grab elements that don't exist yet.
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. DOM ELEMENT REFERENCES ---
    // Let's grab all the pieces of our interface so we can interact with them.
    const grid = document.getElementById('heatmap');
    const generateBtn = document.getElementById('generate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const copyBtn = document.getElementById('copy-btn');
    const copyIcon = document.getElementById('copy-icon');
    const codeOutput = document.getElementById('code-output');
    const colorRadios = document.querySelectorAll('input[name="shade"]');
    const yearSelect = document.getElementById('year-select');
    const timezoneSelect = document.getElementById('timezone');
    
    // Theme-related elements
    const themeToggle = document.getElementById('theme-toggle');
    const htmlRoot = document.documentElement;
    
    // Modal & Guide elements
    const helpBtn = document.getElementById('help-btn');
    const modalOverlay = document.getElementById('modal-overlay');
    const modalQuestion = document.getElementById('modal-question');
    const modalGuide = document.getElementById('modal-guide');
    const closeBtns = document.querySelectorAll('.close-modal-btn');
    
    // Tour elements
    const tourOverlay = document.getElementById('tour-overlay');
    const tourTooltip = document.getElementById('tour-tooltip');
    const tourText = document.getElementById('tour-text');
    const tourNextBtn = document.getElementById('tour-next-btn');
    const tourPrevBtn = document.getElementById('tour-prev-btn');
    const tourSkipBtn = document.getElementById('tour-skip-btn');

    // --- 2. GLOBAL STATE ---
    // We start with the lightest GitHub green as our default brush.
    let selectedColor = '#9be9a8'; 
    let tourStep = 0;

    // This array acts as a map for our interactive tour, linking elements to helpful tips!
    const tourSteps = [
        { id: 'tour-step-1', text: 'Step 1: Pick a year and choose your favorite GitHub green shade.' },
        { id: 'tour-step-2', text: 'Step 2: Scroll if needed, then click and drag to draw your pixel art.' },
        { id: 'tour-step-3', text: 'Step 3: Select your timezone, then generate your commands.' },
        { id: 'tour-step-4', text: 'Step 4: Copy this code and paste it into your Git repository terminal.' }
    ];

    // --- 3. DARK MODE SYSTEM ---
    // We check if the user's computer is natively running in dark mode.
    // If it is, we kindly respect their preference and apply it automatically![cite: 1]
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        htmlRoot.setAttribute('data-theme', 'dark');
    }

    // When they click our fancy animated SVG button, we toggle the state.
    themeToggle.addEventListener('click', () => {
        if (htmlRoot.getAttribute('data-theme') === 'dark') {
            htmlRoot.removeAttribute('data-theme');
        } else {
            htmlRoot.setAttribute('data-theme', 'dark');
        }
    });

    // --- 4. CORE SETUP FUNCTIONS ---

    // This nifty function calculates exactly how far away the user is from UTC time,
    // formats it perfectly (like +0400), and pops it into the dropdown menu.
    function setupTimezone() {
        const offsetMinutes = new Date().getTimezoneOffset();
        const sign = offsetMinutes > 0 ? '-' : '+';
        const absMinutes = Math.abs(offsetMinutes);
        
        // Pad our hours and minutes with zeroes so "4" becomes "04"
        const hours = String(Math.floor(absMinutes / 60)).padStart(2, '0');
        const mins = String(absMinutes % 60).padStart(2, '0');
        const localTzString = `${sign}${hours}${mins}`;
        
        // Build the option and inject it at the top!
        const localOption = document.createElement('option');
        localOption.value = localTzString;
        localOption.textContent = `Local Time (${localTzString})`;
        
        timezoneSelect.insertBefore(localOption, timezoneSelect.firstChild);
        timezoneSelect.value = localTzString;
    }

    // Let's populate the "Year" dropdown, offering the current year and the past decade.
    function setupYearSelect() {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear; y >= currentYear - 10; y--) {
            const option = document.createElement('option');
            option.value = y;
            option.textContent = y;
            yearSelect.appendChild(option);
        }
    }

    // Browsers are tricky—they convert hex colors (#ffffff) into rgb strings (rgb(255,255,255)) internally.
    // We need this little helper to translate our hex choice so we can properly "erase" existing colors.
    function hexToRgbString(hex) {
        const dummy = document.createElement('div');
        dummy.style.color = hex;
        document.body.appendChild(dummy);
        const rgb = window.getComputedStyle(dummy).color;
        document.body.removeChild(dummy);
        return rgb;
    }

    // --- 5. THE HEATMAP ENGINE ---
    // This function builds the actual grid of days based on the year you picked.
    function renderGrid(yearStr) {
        grid.innerHTML = ''; // Clear the canvas!
        
        const year = parseInt(yearStr);
        const startDate = new Date(year, 0, 1);   // January 1st
        const endDate = new Date(year, 11, 31);   // December 31st
        
        // getDay() gives us the day of the week (0 = Sun, 6 = Sat).
        // GitHub weeks start on Sunday. We need this to push Jan 1st to the correct row!
        const startDayOffset = startDate.getDay(); 

        let currentDate = new Date(startDate);
        let isFirstDay = true; // We use this flag to set the anchor point of our grid
        
        // We'll walk through the calendar day-by-day until the year ends
        while (currentDate <= endDate) {
            const square = document.createElement('div');
            square.classList.add('day-square');
            
            // Extract the exact year, month, and day directly from the local date
            // to avoid pesky timezone-shifting bugs when converting to strings.
            const y = currentDate.getFullYear();
            const m = String(currentDate.getMonth() + 1).padStart(2, '0');
            const d = String(currentDate.getDate()).padStart(2, '0');
            
            square.dataset.date = `${y}-${m}-${d}`;

            // MAGIC TRICK: By explicitly telling CSS Grid which row to place the VERY FIRST day, 
            // it naturally flows the rest of the 364 days sequentially behind it.
            // This perfectly mimics GitHub's jagged first column depending on the day of the week!
            if (isFirstDay) {
                square.style.gridRow = startDayOffset + 1;
                isFirstDay = false;
            }

            // The paint logic for our little squares
            const paintSquare = () => {
                const targetRgb = hexToRgbString(selectedColor);
                if (square.style.backgroundColor === targetRgb) {
                    square.style.backgroundColor = ''; // Erase if it matches the active brush
                    square.removeAttribute('data-active');
                } else {
                    square.style.backgroundColor = selectedColor; // Paint it!
                    square.setAttribute('data-active', 'true');
                }
            };

            // Allow the user to paint with single clicks (button 0 = left click)
            square.addEventListener('mousedown', (e) => {
                if (e.button === 0) paintSquare(); 
            });
            
            // Or allow them to click-and-drag across the board to draw smoothly
            square.addEventListener('mouseenter', (e) => {
                if (e.buttons === 1) paintSquare(); 
            });

            grid.appendChild(square);
            
            // Move forward one calendar day
            currentDate.setDate(currentDate.getDate() + 1); 
        }
    }

    // --- 6. ONBOARDING & TOUR LOGIC ---
    
    // First time here? We'll show you the ropes if you don't have the local storage flag.
    if (!localStorage.getItem('gitart_onboarded')) {
        openModal('question');
    }

    // Manual triggers to open the guide
    helpBtn.addEventListener('click', () => openModal('question'));

    function openModal(type) {
        modalOverlay.classList.remove('hidden');
        modalQuestion.classList.add('hidden');
        modalGuide.classList.add('hidden');
        
        if (type === 'question') modalQuestion.classList.remove('hidden');
        if (type === 'guide') modalGuide.classList.remove('hidden');
    }

    function closeModal() {
        modalOverlay.classList.add('hidden');
        // Let's set a flag so we don't bother them on their next visit
        localStorage.setItem('gitart_onboarded', 'true'); 
    }

    function endTour() {
        tourOverlay.classList.add('hidden');
        tourTooltip.classList.add('hidden');
        document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
    }

    // Connect all the modal buttons
    closeBtns.forEach(btn => btn.addEventListener('click', closeModal));
    document.getElementById('btn-no-git').addEventListener('click', () => openModal('guide'));
    document.getElementById('btn-knows-git').addEventListener('click', () => { closeModal(); startTour(); });
    document.getElementById('start-tour-from-guide').addEventListener('click', () => { closeModal(); startTour(); });

    // The Guided Tour Controller
    function startTour() {
        tourStep = 0;
        tourOverlay.classList.remove('hidden');
        tourTooltip.classList.remove('hidden');
        showTourStep();
    }

    function showTourStep() {
        // Clear old highlights
        document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));

        if (tourStep >= tourSteps.length) {
            endTour();
            return;
        }

        // Apply a glowing highlight to the element for the current step
        const currentData = tourSteps[tourStep];
        const targetElement = document.getElementById(currentData.id);
        
        // We gently scroll the screen so the user doesn't lose track of what we're talking about
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetElement.classList.add('tour-highlight');
        
        tourText.textContent = currentData.text;
        
        // Switch "Next" to "Finish" on the final step, and hide "Previous" on the first
        tourNextBtn.textContent = (tourStep === tourSteps.length - 1) ? "Finish" : "Next";
        tourPrevBtn.style.display = (tourStep === 0) ? "none" : "flex"; 

        // Let's position the helpful tooltip right beneath the highlighted element!
        setTimeout(() => {
            const rect = targetElement.getBoundingClientRect();
            const absoluteTop = window.scrollY + rect.bottom + 20; 
            
            tourTooltip.style.top = `${absoluteTop}px`;
            tourTooltip.style.left = `50%`;
            tourTooltip.style.transform = `translateX(-50%)`;
        }, 300); // 300ms timeout gives the smooth scrolling time to land gracefully
    }

    // Navigation buttons for the tour
    tourNextBtn.addEventListener('click', () => { tourStep++; showTourStep(); });
    tourPrevBtn.addEventListener('click', () => { if (tourStep > 0) { tourStep--; showTourStep(); } });
    tourSkipBtn.addEventListener('click', endTour);

    // --- 7. APPLICATION CONTROLS ---

    // We disable the browser's default drag behavior on the grid.
    // If we didn't do this, trying to draw would accidentally highlight the grid as text!
    grid.addEventListener('dragstart', (e) => e.preventDefault());

    // Switch paint colors instantly
    colorRadios.forEach(radio => {
        radio.addEventListener('change', (e) => selectedColor = e.target.value);
    });

    // Rebuild the grid dynamically if the user wants to draw in a different year
    yearSelect.addEventListener('change', (e) => {
        renderGrid(e.target.value);
        codeOutput.value = ""; // Clear out stale code so they don't commit to the wrong year
    });

    // The ultimate eraser
    resetBtn.addEventListener('click', () => {
        const squares = document.querySelectorAll('.day-square[data-active="true"]');
        squares.forEach(square => {
            square.style.backgroundColor = '';
            square.removeAttribute('data-active');
        });
        codeOutput.value = "";
    });

    // --- 8. COPY TO CLIPBOARD INTEGRATION ---
    copyBtn.addEventListener('click', async () => {
        if (!codeOutput.value) return; 
        
        try {
            // Securely write to the user's system clipboard
            await navigator.clipboard.writeText(codeOutput.value);
            
            // Give them a nice little visual confirmation
            copyIcon.textContent = "[Copied!]";
            copyBtn.style.backgroundColor = "var(--gh-green-2)";
            
            // Snap back to normal after a brief delay
            setTimeout(() => {
                copyIcon.textContent = "[Copy]";
                copyBtn.style.backgroundColor = "var(--sunlit-clay)";
            }, 2000);
        } catch (err) {
            alert('Clipboard access denied! Please select the text and copy manually.');
        }
    });

    // --- 9. THE SCRIPT GENERATOR ---
    generateBtn.addEventListener('click', () => {
        // We only care about the squares that have been painted on
        const activeSquares = document.querySelectorAll('.day-square[data-active="true"]');
        const timezone = timezoneSelect.value;
        
        let script = "#!/bin/bash\n\n";

        if (activeSquares.length === 0) {
            codeOutput.value = "Hey! You need to draw something on the grid first!";
            return;
        }

        // Let's build a chain of sneaky git commands
        activeSquares.forEach(square => {
            const dateStr = square.dataset.date;
            const timeStr = "12:00:00"; // We use noon to avoid nasty timezone midnight crossovers
            const gitDate = `${dateStr} ${timeStr} ${timezone}`;
            
            // The magic: --allow-empty lets us commit without modifying actual code files.
            // By forcefully overriding the AUTHOR and COMMITTER dates, we hack the GitHub timeline!
            script += `GIT_AUTHOR_DATE="${gitDate}" GIT_COMMITTER_DATE="${gitDate}" git commit --allow-empty -m "Art commit for ${dateStr}"\n`;
        });

        // Drop the final product into the text area
        codeOutput.value = script;
    });

    // --- 10. LIFTOFF ---
    // Let's get everything fired up and ready to go!
    setupTimezone();
    setupYearSelect();
    renderGrid(yearSelect.value);

});