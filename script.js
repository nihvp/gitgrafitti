// Hey there! We wait for the entire HTML document to load before running our script
// to ensure we don't accidentally try to grab elements that don't exist yet.
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. DOM ELEMENT REFERENCES ---
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

    const tourSteps = [
        { id: 'tour-step-1', text: 'Step 1: Pick a year and choose your favorite GitHub green shade.' },
        { id: 'tour-step-2', text: 'Step 2: Scroll if needed, then click and drag to draw your pixel art.' },
        { id: 'tour-step-3', text: 'Step 3: Select your timezone, then generate your commands.' },
        { id: 'tour-step-4', text: 'Step 4: Copy this code and paste it into your Git repository terminal.' }
    ];

    // --- 3. DARK MODE SYSTEM ---
    // Does the user love dark mode natively on their machine? Let's respect that immediately!
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        htmlRoot.setAttribute('data-theme', 'dark');
    }

    themeToggle.addEventListener('click', () => {
        if (htmlRoot.getAttribute('data-theme') === 'dark') {
            htmlRoot.removeAttribute('data-theme');
        } else {
            htmlRoot.setAttribute('data-theme', 'dark');
        }
    });

    // --- 4. CORE SETUP FUNCTIONS ---

    // Automatically calculates the user's local timezone offset (like +0400) and drops it in the list.
    function setupTimezone() {
        const offsetMinutes = new Date().getTimezoneOffset();
        const sign = offsetMinutes > 0 ? '-' : '+';
        const absMinutes = Math.abs(offsetMinutes);
        
        // Pad our hours and minutes with zeroes so "4" becomes "04"
        const hours = String(Math.floor(absMinutes / 60)).padStart(2, '0');
        const mins = String(absMinutes % 60).padStart(2, '0');
        const localTzString = `${sign}${hours}${mins}`;
        
        const localOption = document.createElement('option');
        localOption.value = localTzString;
        localOption.textContent = `Local Time (${localTzString})`;
        
        timezoneSelect.insertBefore(localOption, timezoneSelect.firstChild);
        timezoneSelect.value = localTzString;
    }

    // Populate the dropdown with the current year and the last decade.
    function setupYearSelect() {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear; y >= currentYear - 10; y--) {
            const option = document.createElement('option');
            option.value = y;
            option.textContent = y;
            yearSelect.appendChild(option);
        }
    }

    // ⭐ OPTIMIZATION: A caching dictionary for our Hex-to-RGB conversions!
    // DOM querying is slow. Now, we only calculate a color's RGB string ONCE, then save it here forever.
    const rgbCache = {};

    function hexToRgbString(hex) {
        if (rgbCache[hex]) return rgbCache[hex]; // Fast track: return from cache instantly!
        
        const dummy = document.createElement('div');
        dummy.style.color = hex;
        document.body.appendChild(dummy);
        const rgb = window.getComputedStyle(dummy).color;
        document.body.removeChild(dummy);
        
        rgbCache[hex] = rgb; // Save it to the vault
        return rgb;
    }

    // --- 5. THE HEATMAP ENGINE ---

    // The logic to paint or erase a single square.
    function paintSquare(square) {
        const targetRgb = hexToRgbString(selectedColor);
        if (square.style.backgroundColor === targetRgb) {
            square.style.backgroundColor = ''; // Erase if it matches the active brush
            square.removeAttribute('data-active');
        } else {
            square.style.backgroundColor = selectedColor; // Paint it!
            square.setAttribute('data-active', 'true');
        }
    }

    // ⭐ OPTIMIZATION: Event Delegation!
    // Instead of tying 730 separate event listeners to 365 squares, we tie TWO to the main grid.
    // The grid acts like a catcher's mitt, intercepting clicks meant for the squares inside it.
    grid.addEventListener('mousedown', (e) => {
        if (e.button === 0 && e.target.classList.contains('day-square')) {
            paintSquare(e.target);
        }
    });
    
    // We use 'mouseover' instead of 'mouseenter' because mouseover bubbles up to our catcher's mitt!
    grid.addEventListener('mouseover', (e) => {
        if (e.buttons === 1 && e.target.classList.contains('day-square')) {
            paintSquare(e.target);
        }
    });

    // This builds the calendar grid dynamically
    function renderGrid(yearStr) {
        grid.innerHTML = ''; // Clear the canvas!
        
        // ⭐ OPTIMIZATION: Document Fragments
        // Instead of forcing the browser to redraw the screen 365 times, we build the entire
        // year in an invisible "fragment" in memory, and then slap it onto the DOM all at once. Lightning fast! ⚡
        const fragment = document.createDocumentFragment(); 
        
        const year = parseInt(yearStr);
        const startDate = new Date(year, 0, 1);   
        const endDate = new Date(year, 11, 31);   
        
        // Push Jan 1st to the correct day of the week to mimic GitHub perfectly
        const startDayOffset = startDate.getDay(); 

        let currentDate = new Date(startDate);
        let isFirstDay = true; 
        
        while (currentDate <= endDate) {
            const square = document.createElement('div');
            square.classList.add('day-square');
            
            // Extract the exact YYYY-MM-DD to avoid timezone shifting
            const y = currentDate.getFullYear();
            const m = String(currentDate.getMonth() + 1).padStart(2, '0');
            const d = String(currentDate.getDate()).padStart(2, '0');
            
            square.dataset.date = `${y}-${m}-${d}`;

            // Set the grid row anchor for the very first day
            if (isFirstDay) {
                square.style.gridRow = startDayOffset + 1;
                isFirstDay = false;
            }

            // Notice we don't attach event listeners here anymore! The grid handles it all.
            fragment.appendChild(square);
            
            // Step forward one calendar day
            currentDate.setDate(currentDate.getDate() + 1); 
        }
        
        // Paint the entire year in one swift motion
        grid.appendChild(fragment);
    }

    // --- 6. ONBOARDING & TOUR LOGIC ---
    
    if (!localStorage.getItem('gitart_onboarded')) {
        openModal('question');
    }

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
        localStorage.setItem('gitart_onboarded', 'true'); // Flag to prevent popping up on refresh
    }

    function endTour() {
        tourOverlay.classList.add('hidden');
        tourTooltip.classList.add('hidden');
        document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
    }

    // Connect modal buttons
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
        document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));

        if (tourStep >= tourSteps.length) {
            endTour();
            return;
        }

        // Apply a glowing highlight to the element for the current step
        const currentData = tourSteps[tourStep];
        const targetElement = document.getElementById(currentData.id);
        
        // Smoothly scroll down so they don't lose focus
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetElement.classList.add('tour-highlight');
        
        tourText.textContent = currentData.text;
        
        tourNextBtn.textContent = (tourStep === tourSteps.length - 1) ? "Finish" : "Next";
        tourPrevBtn.style.display = (tourStep === 0) ? "none" : "flex"; 

        // Position the helpful tooltip right beneath the highlighted element!
        setTimeout(() => {
            const rect = targetElement.getBoundingClientRect();
            const absoluteTop = window.scrollY + rect.bottom + 20; 
            
            tourTooltip.style.top = `${absoluteTop}px`;
            tourTooltip.style.left = `50%`;
            tourTooltip.style.transform = `translateX(-50%)`;
        }, 300); // Wait for the smooth scroll to finish moving
    }

    tourNextBtn.addEventListener('click', () => { tourStep++; showTourStep(); });
    tourPrevBtn.addEventListener('click', () => { if (tourStep > 0) { tourStep--; showTourStep(); } });
    tourSkipBtn.addEventListener('click', endTour);

    // --- 7. APPLICATION CONTROLS ---

    // Prevent grid highlighting text while drawing
    grid.addEventListener('dragstart', (e) => e.preventDefault());

    // Switch paint colors instantly
    colorRadios.forEach(radio => {
        radio.addEventListener('change', (e) => selectedColor = e.target.value);
    });

    // Rebuild grid for different years
    yearSelect.addEventListener('change', (e) => {
        renderGrid(e.target.value);
        codeOutput.value = ""; // Clear stale code to prevent bad pushes
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
            await navigator.clipboard.writeText(codeOutput.value);
            
            copyIcon.textContent = "[Copied!]";
            copyBtn.style.backgroundColor = "var(--gh-green-2)";
            
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
        const activeSquares = document.querySelectorAll('.day-square[data-active="true"]');
        const timezone = timezoneSelect.value;
        
        let script = "#!/bin/bash\n\n";

        if (activeSquares.length === 0) {
            codeOutput.value = "Hey! You need to draw something on the grid first!";
            return;
        }

        activeSquares.forEach(square => {
            const dateStr = square.dataset.date;
            const timeStr = "12:00:00"; // Fixed to noon to dodge midnight timezone bugs
            const gitDate = `${dateStr} ${timeStr} ${timezone}`;
            
            // The magic: By spoofing AUTHOR and COMMITTER dates on an empty commit, we hack the GitHub timeline!
            script += `GIT_AUTHOR_DATE="${gitDate}" GIT_COMMITTER_DATE="${gitDate}" git commit --allow-empty -m "Art commit for ${dateStr}"\n`;
        });

        codeOutput.value = script;
    });

    // --- 10. LIFTOFF ---
    setupTimezone();
    setupYearSelect();
    renderGrid(yearSelect.value);

});