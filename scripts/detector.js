(function() {
  const technologies = {};
  
  // We will receive the list of window variables to check from the content script 
  // or we can hardcode checks here.
  // To keep it dynamic, we'll listen for a message or just check comprehensive list if passed.
  // SIMPLIFICATION: For now, let's try to detect based on a known list we have or can infer.
  // Actually, passing the huge JSON to the main world might be slow. 
  // Let's rely on the content script passing 'window' keys to check, OR 
  // since we can't easily pass the config *synchronously* before checking, 
  // maybe we just check 'all' properties of window? No, that's too much.
  
  // Better approach: 
  // The content script will inject this script. 
  // This script will check for a specific set of global variables.
  // Since we want to keep logic in one place, let's just emit *all* global variable names?
  // No, that's huge.
  
  // Revised approach:
  // We will define the check logic here.
  // We'll listen for a custom event from the content script carrying the keys to check.
  
  window.addEventListener('WebAnalyst_Check', function(e) {
    const keysToCheck = e.detail; // Array of window keys e.g. ["React", "Vue", "jQuery"]
    const detected = [];
    
    if (keysToCheck && Array.isArray(keysToCheck)) {
      keysToCheck.forEach(key => {
        if (window[key] !== undefined) {
          detected.push(key);
        }
      });
    }
    
    // Send back results
    window.postMessage({ type: 'WebAnalyst_Result', detected: detected }, '*');
  });

})();
