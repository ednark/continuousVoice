window.addEventListener("DOMContentLoaded", (event) => {
    if ( ! RevealVoice ) { return }

    function createClosedCaptionDisplay() {
        let cc_container = document.getElementById('cc-container');
        if ( ! cc_container ) {
            cc_container = document.createElement('div');
            cc_container.id = 'cc-container';
            let cc_window = document.getElementById('cc-window');
            if ( ! cc_window ) {
                cc_window = document.createElement('span');
                cc_window.id = 'cc-window';
                cc_window.innerHTML = '<br />';
            }
            if ( ! cc_container.contains(cc_window) ) {
                cc_container.appendChild(cc_window);
            }
            if ( ! document.body.contains(cc_container) ) {
                document.body.appendChild(cc_container);
            }
        }
    }

    /// add closed caption stuff
    function displayClosedCaption(speechEvent) {

        let cc_window = document.getElementById('cc-window');
        if ( ! cc_window ) {
            createClosedCaptionDisplay()
            cc_window = document.getElementById('cc-window');
            if ( ! cc_window ) {
                return;
            }
        }
    
        if ( ! speechEvent ) {
            return;
        }

        let ogHeight = cc_window.offsetHeight
    
        let cc_line = document.getElementById('transcript-log-'+speechEvent.detail.id);
        if ( !cc_line ) {
            cc_line = document.createElement('span');
            cc_line.id = 'transcript-log-'+speechEvent.detail.id;
            cc_line.classList.add('cc-text');
            cc_window.appendChild(cc_line);
        }
    
        cc_line.innerHTML = speechEvent.detail.transcript;
    
        let currHeight = cc_window.offsetHeight
        let distance = Math.max(0, currHeight-ogHeight)
    
        if ( distance > 0 ) {
            // smooth scroll
            clearTimeout(cc_window.resetPositionTimer);
            cc_window.resetPositionTimer = null;
    
            let time = 0.25;
    
            cc_window.style.transition = "none";
            cc_window.style.bottom = `0px`;
            cc_window.style.transform = `translateY(0px)`;
    
            cc_window.style.transition = `transform ${time}s ease-in`;
            cc_window.style.bottom = `-${distance}px`;
            cc_window.style.transform = `translateY(-${distance}px)`;
    
            cc_window.resetPositionTimer = setTimeout(() => {
                cc_window.style.transition = "none";
                cc_window.style.bottom = `0px`;
                cc_window.style.transform = `translateY(0px)`;
            }, (time*1000) );
        }
    }

    RevealVoice.addEventListener('interimResult',displayClosedCaption);
    RevealVoice.addEventListener('finalResult',displayClosedCaption);

    function hideClosedCaptions() {
        let cc_container = document.getElementById('cc-container');
        if ( ! cc_container ) { return; }
        cc_container.classList.add('hidden');
    }
    function showClosedCaptions() {
        let cc_container = document.getElementById('cc-container');
        if ( ! cc_container ) { return; }
        cc_container.classList.remove('hidden');
    }
    function toggleClosedCaptions() {
        let cc_container = document.getElementById('cc-container');
        if ( ! cc_container ) { return; }
        cc_container.classList.toggle('hidden');
    }

    RevealVoice.addCommand([
        'hide closed captions', 'hide captions',
        'remove closed captions', 'remove captions'
    ],hideClosedCaptions);

    RevealVoice.addCommand([
        'show closed captions', 'show captions', 
        'display closed captions', 'display captions', 
        'give me closed captions', 'give me captions',
        'bring back closed captions', 'bring back captions'
    ],showClosedCaptions);

    RevealVoice.addCommand([
        'toggle closed captions', 'toggle captions'
    ],toggleClosedCaptions);

    displayClosedCaption(null);

});