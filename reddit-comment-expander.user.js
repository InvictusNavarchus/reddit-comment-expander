// ==UserScript==
// @name         Reddit - Expand All Comments
// @namespace    https://github.com/InvictusNavarchus/reddit-comment-expander
// @version      0.1.1
// @description  Adds a button to Reddit threads to automatically click all "X more replies" buttons and expand collapsed comments, with a progress bar. Works on the latest Reddit UI.
// @author       Invictus Navarchus
// @match        https://*.reddit.com/r/*/comments/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // --- METADATA ---
    const SCRIPT_NAME = 'Reddit Expander';
    const SCRIPT_EMOJI = '💬';
    const VERSION = '0.1.0';

    // --- STATE MANAGEMENT ---
    let clickedCount = 0;
    let totalCount = 0;
    let observer = null;
    let completionTimeout = null;
    let isRunning = false;
    let debouncedFindAndClick = null;


    // --- UTILITIES ---

    /**
     * Generates a logging prefix with script name, emoji, and timestamp.
     * @returns {string} The formatted log prefix.
     */
    function getPrefix() {
        const now = new Date();
        const time = now.toTimeString().split(' ')[0];
        return `[${SCRIPT_NAME} ${SCRIPT_EMOJI} ${time}]`;
    }

    /**
     * Debounce function to limit the rate at which a function gets called.
     * @param {Function} func The function to debounce.
     * @param {number} wait The debounce delay in milliseconds.
     * @returns {Function} The debounced function.
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }


    // --- UI & STYLING ---

    /**
     * Injects the necessary CSS for the UI elements into the page.
     */
    function injectStyles() {
        GM_addStyle(`
            #re-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                background-color: #1A1A1B;
                color: #D7DADC;
                padding: 12px;
                border-radius: 8px;
                border: 1px solid #343536;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                font-size: 14px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                width: 260px;
            }
            #re-trigger-btn {
                background-color: #0079D3;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 5px;
                cursor: pointer;
                text-align: center;
                font-weight: bold;
                transition: background-color 0.2s;
            }
            #re-trigger-btn:hover {
                background-color: #1484D7;
            }
            #re-trigger-btn:disabled {
                background-color: #555;
                cursor: not-allowed;
            }
            #re-progress-container {
                display: none; /* Hidden by default */
                width: 100%;
                background-color: #343536;
                border-radius: 5px;
                overflow: hidden;
                height: 22px;
            }
            #re-progress-bar {
                width: 0%;
                height: 100%;
                background-color: #4CAF50;
                transition: width 0.3s ease-in-out, background-color 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 12px;
            }
        `);
        console.log(getPrefix(), 'CSS styles injected.');
    }

    /**
     * Creates and injects the main UI container, button, and progress bar.
     */
    function createUI() {
        const container = document.createElement('div');
        container.id = 're-container';

        const triggerBtn = document.createElement('button');
        triggerBtn.id = 're-trigger-btn';
        triggerBtn.textContent = 'Expand All Comments';
        triggerBtn.addEventListener('click', startExpansion);

        const progressContainer = document.createElement('div');
        progressContainer.id = 're-progress-container';

        const progressBar = document.createElement('div');
        progressBar.id = 're-progress-bar';
        progressBar.textContent = '0%';

        progressContainer.appendChild(progressBar);
        container.appendChild(triggerBtn);
        container.appendChild(progressContainer);

        document.body.appendChild(container);
        console.log(getPrefix(), 'UI created and appended to body.');
    }

    /**
     * Updates the progress bar's width and text based on the current state.
     */
    function updateProgressBar() {
        const progressBar = document.getElementById('re-progress-bar');
        if (!progressBar) return;

        const percentage = totalCount > 0 ? Math.round((clickedCount / totalCount) * 100) : 0;
        progressBar.style.width = `${percentage}%`;
        progressBar.textContent = `${clickedCount} / ${totalCount} (${percentage}%)`;
    }

    /**
     * Updates the UI to show the completion state.
     */
    function showCompletion() {
        console.log(getPrefix(), 'Expansion process complete.');
        const progressBar = document.getElementById('re-progress-bar');
        if (progressBar) {
            progressBar.style.backgroundColor = '#0079D3'; // Change color to blue
            progressBar.textContent = `Complete! Expanded ${clickedCount} sections.`;
        }
        const triggerBtn = document.getElementById('re-trigger-btn');
        if(triggerBtn) {
            triggerBtn.disabled = false;
            triggerBtn.style.display = 'block';
            triggerBtn.textContent = 'Expand More (if any)';
        }
    }


    // --- CORE LOGIC ---

    /**
     * Searches through shadow DOM trees to find elements matching a selector.
     * @param {Element} root The root element to search from.
     * @param {string} selector The CSS selector to match.
     * @returns {Array} Array of matching elements.
     */
    function querySelectorAllDeep(root, selector) {
        const results = [];
        
        // Search in the current document/element
        results.push(...Array.from(root.querySelectorAll(selector)));
        
        // Search in shadow DOM trees
        const elementsWithShadow = root.querySelectorAll('*');
        for (const element of elementsWithShadow) {
            if (element.shadowRoot) {
                results.push(...querySelectorAllDeep(element.shadowRoot, selector));
            }
        }
        
        return results;
    }

    /**
     * Finds and clicks all unprocessed "more replies" buttons and collapsed comment buttons.
     */
    async function findAndClick() {
        console.log(getPrefix(), 'Scanning for expandable buttons...');
        
        // Selector for "more replies" buttons
        const moreRepliesSelector = 'faceplate-partial[src*="/svc/shreddit/more-comments/"] button';
        const moreRepliesButtons = querySelectorAllDeep(document, moreRepliesSelector);

        // Selector for collapsed comment expand buttons (details > summary button with plus icon)
        // Search for shreddit-comment elements with collapsed attribute
        const collapsedComments = querySelectorAllDeep(document, 'shreddit-comment[collapsed]');
        const collapsedCommentButtons = [];
        
        // For each collapsed comment, look for the expand button in its shadow DOM
        for (const comment of collapsedComments) {
            if (comment.shadowRoot) {
                const expandButtons = comment.shadowRoot.querySelectorAll('details[role="article"] summary button svg[icon-name="join-outline"]');
                for (const icon of expandButtons) {
                    // Navigate up to find the button element
                    let element = icon.parentElement;
                    while (element && element.tagName !== 'BUTTON') {
                        element = element.parentElement;
                    }
                    if (element) {
                        collapsedCommentButtons.push(element);
                    }
                }
            }
        }

        // Combine both types of buttons
        const allButtons = [...moreRepliesButtons, ...collapsedCommentButtons];

        // Filter for visible, unprocessed buttons. Reddit's HTML includes a hidden
        // button in the "loading" template, which we must exclude.
        const buttonsToClick = allButtons.filter(btn =>
            !btn.closest('[slot="loading"]') && // Exclude buttons in the loading template
            !btn.dataset.redditExpanderProcessed // Exclude buttons we've already processed
        );

        if (buttonsToClick.length > 0) {
            console.log(getPrefix(), `Found ${buttonsToClick.length} new expandable button(s).`);
            // If we found buttons, cancel any pending completion timeout.
            if (completionTimeout) {
                clearTimeout(completionTimeout);
                completionTimeout = null;
            }

            totalCount += buttonsToClick.length;
            updateProgressBar();

            for (const button of buttonsToClick) {
                if(!isRunning) {
                    console.log(getPrefix(), 'Process was stopped. Halting clicks.');
                    return;
                }
                button.dataset.redditExpanderProcessed = 'true';
                button.click();
                clickedCount++;
                updateProgressBar();
                console.log(getPrefix(), `Clicked button ${clickedCount}/${totalCount}.`);
                // Add a small delay to prevent overwhelming Reddit's servers and the browser.
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        } else {
            console.log(getPrefix(), 'No new expandable buttons found in this scan.');
            // If no buttons found and no completion timeout is set, start one immediately
            if (!completionTimeout && isRunning) {
                console.log(getPrefix(), 'No buttons found. Setting immediate completion timer (1 second).');
                completionTimeout = setTimeout(() => {
                    console.log(getPrefix(), 'Completion timer fired. Final check...');
                    // One last check to be sure - check both types of buttons
                    const finalMoreRepliesButtons = querySelectorAllDeep(document, moreRepliesSelector);
                    const finalCollapsedComments = querySelectorAllDeep(document, 'shreddit-comment[collapsed]');
                    const finalCollapsedCommentButtons = [];
                    
                    for (const comment of finalCollapsedComments) {
                        if (comment.shadowRoot) {
                            const expandButtons = comment.shadowRoot.querySelectorAll('details[role="article"] summary button svg[icon-name="join-outline"]');
                            for (const icon of expandButtons) {
                                let element = icon.parentElement;
                                while (element && element.tagName !== 'BUTTON') {
                                    element = element.parentElement;
                                }
                                if (element) {
                                    finalCollapsedCommentButtons.push(element);
                                }
                            }
                        }
                    }
                    
                    const finalAllButtons = [...finalMoreRepliesButtons, ...finalCollapsedCommentButtons];
                    const finalButtonsToClick = finalAllButtons.filter(btn =>
                        !btn.closest('[slot="loading"]') && !btn.dataset.redditExpanderProcessed
                    );

                    if (finalButtonsToClick.length === 0) {
                        isRunning = false;
                        showCompletion();
                        if(observer) {
                            observer.disconnect();
                            console.log(getPrefix(), 'MutationObserver stopped.');
                        }
                    } else {
                        console.log(getPrefix(), 'False alarm, more buttons appeared. Continuing scan.');
                        completionTimeout = null;
                        findAndClick();
                    }
                }, 1000); // Shorter timeout when no buttons found initially
            }
        }

        // After every scan, set a timeout to check for completion. If no new buttons
        // are found for a few seconds, we assume the process is done.
        if (!completionTimeout && isRunning) {
            console.log(getPrefix(), 'Setting completion timer (3 seconds).');
            completionTimeout = setTimeout(() => {
                console.log(getPrefix(), 'Completion timer fired. Final check...');
                // One last check to be sure - check both types of buttons
                const finalMoreRepliesButtons = querySelectorAllDeep(document, moreRepliesSelector);
                const finalCollapsedComments = querySelectorAllDeep(document, 'shreddit-comment[collapsed]');
                const finalCollapsedCommentButtons = [];
                
                for (const comment of finalCollapsedComments) {
                    if (comment.shadowRoot) {
                        const expandButtons = comment.shadowRoot.querySelectorAll('details[role="article"] summary button svg[icon-name="join-outline"]');
                        for (const icon of expandButtons) {
                            let element = icon.parentElement;
                            while (element && element.tagName !== 'BUTTON') {
                                element = element.parentElement;
                            }
                            if (element) {
                                finalCollapsedCommentButtons.push(element);
                            }
                        }
                    }
                }
                
                const finalAllButtons = [...finalMoreRepliesButtons, ...finalCollapsedCommentButtons];
                const finalButtonsToClick = finalAllButtons.filter(btn =>
                    !btn.closest('[slot="loading"]') && !btn.dataset.redditExpanderProcessed
                );

                if (finalButtonsToClick.length === 0) {
                    isRunning = false;
                    showCompletion();
                    if(observer) {
                        observer.disconnect();
                        console.log(getPrefix(), 'MutationObserver stopped.');
                    }
                } else {
                    console.log(getPrefix(), 'False alarm, more buttons appeared. Continuing scan.');
                    completionTimeout = null;
                    findAndClick();
                }
            }, 3000);
        }
    }

    /**
     * Initializes the expansion process. Called by the trigger button.
     */
    function startExpansion() {
        if (isRunning) {
            console.log(getPrefix(), 'Process is already running.');
            return;
        }
        console.log(getPrefix(), 'Expansion process started by user.');
        isRunning = true;

        const triggerBtn = document.getElementById('re-trigger-btn');
        const progressContainer = document.getElementById('re-progress-container');
        const progressBar = document.getElementById('re-progress-bar');
        
        if (triggerBtn) {
            triggerBtn.style.display = 'none';
            triggerBtn.disabled = true;
        }
        if (progressContainer) progressContainer.style.display = 'block';
        
        // Reset progress bar appearance for fresh run
        if (progressBar) {
            progressBar.style.backgroundColor = '#4CAF50'; // Reset to green
        }

        // Reset state for a fresh run
        clickedCount = 0;
        totalCount = 0;
        updateProgressBar();
        if (observer) observer.disconnect();
        if (completionTimeout) clearTimeout(completionTimeout);
        completionTimeout = null;

        // Initial scan
        findAndClick();

        // Setup MutationObserver to watch for new buttons loaded dynamically.
        debouncedFindAndClick = debounce(findAndClick, 500);

        observer = new MutationObserver((mutations) => {
            if (!isRunning) return;

            for (const mutation of mutations) {
                 if (mutation.addedNodes.length > 0) {
                     // Efficiently check if any added nodes might contain our target buttons
                     const hasTargetNode = Array.from(mutation.addedNodes).some(node =>
                         node.nodeType === 1 && (
                             node.matches('faceplate-partial') || 
                             node.querySelector('faceplate-partial') ||
                             node.matches('shreddit-comment') ||
                             node.querySelector('shreddit-comment')
                         )
                     );
                     if (hasTargetNode) {
                        console.log(getPrefix(), 'DOM change detected, queueing a re-scan.');
                        debouncedFindAndClick();
                        return;
                     }
                 }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        console.log(getPrefix(), 'MutationObserver started.');
    }

    // --- INITIALIZATION ---
    console.log(getPrefix(), `Script loaded (v${VERSION}).`);
    injectStyles();
    createUI();

})();