
function resetListener()
{
    // console.log('resetListener()');
    if ( typeof resetState === 'function' ) {
        // console.log('resetState()');
        resetState()
    }

    if ( typeof handleVoiceResult !== 'function' ) {
        return
    }

    /// reset the entry point for the voice results
    // console.log('init handleVoiceResult')
    ContinuousVoice.removeEventListener('interimResult',handleVoiceResult);
    ContinuousVoice.removeEventListener('stableResult',handleVoiceResult);
    ContinuousVoice.removeEventListener('finalResult',handleVoiceResult);

    let radioElement = null
    let radioElements = document.querySelectorAll('input[name="follow-style"]')
    let followStyle = 'interim'
    for ( var i = 0; i < radioElements.length; i++ ) {
        if ( radioElements[i].checked ) {
            followStyle = radioElements[i].value
            radioElements[i].checked = false
        }
    }
    switch(followStyle) {
        case 'final':
            radioElement = document.getElementById('follow-style-final')
            if ( radioElement ) {
                radioElement.checked = true
            }
            ContinuousVoice.addEventListener('finalResult',handleVoiceResult);
            break;

        case 'stable':
            radioElement = document.getElementById('follow-style-stable')
            if ( radioElement ) {
                radioElement.checked = true
            }
            ContinuousVoice.addEventListener('stableResult',handleVoiceResult);
            break;

        case 'interim':
        default:
            radioElement = document.getElementById('follow-style-interim')
            if ( radioElement ) {
                radioElement.checked = true
            }
            ContinuousVoice.addEventListener('interimResult',handleVoiceResult);
            break;
    }
}

document.addEventListener('DOMContentLoaded', () => {

    /// setup listening event radio buttons
    listeningRadios = document.querySelectorAll('input[name="follow-style"]')
    if ( listeningRadios.length > 0 ) {
        // console.log('init radio buttons')
        for ( var i = 0; i < listeningRadios.length; i++ ) {
            listeningRadios[i].addEventListener('change', () => {
                resetListener()
            })
        }
    }

    // setup listening on/off switch
    listeningSwitch = document.querySelector('#listening-switch')       
    if ( listeningSwitch ) {
        // console.log('init listening switch')
        // tie checkbox to listener - push state
        listeningSwitch.addEventListener('change', (event) => {
            if (listeningSwitch && listeningSwitch.checked) {
                ContinuousVoice.startListening();
            } else {
                ContinuousVoice.stopListening();
            }
        } )

        // tie checkbox to listener - pull state
        ContinuousVoice.addEventListener('listenStop',() => {
            listeningSwitch.checked = false
        });
        ContinuousVoice.addEventListener('listenStart',() => {
            listeningSwitch.checked = true
        });
    }

    // setup display for any speech
    if ( document.getElementById('speechVisualizer') ) {
        // console.log('init speech visualizer')
        let radioElements = document.querySelectorAll('input[name="follow-style"]')
        let followStyle = 'interim'
        for ( var i = 0; i < radioElements.length; i++ ) {
            if ( radioElements[i].checked ) {
                followStyle = radioElements[i].value
                radioElements[i].checked = false
            }
        }
        // console.log('init speech visualizer with followStyle =',followStyle)
        switch(followStyle) {
            case 'final':
                ContinuousVoice.addEventListener('finalResult',(event) => {   
                    let dest = document.getElementById('speechVisualizerText');
                    if ( dest ) {
                        dest.innerHTML = event.detail.id+" : "+event.detail.transcript;
                    }
                });
                break;

            case 'stable':
                ContinuousVoice.addEventListener('stableResult',(event) => {   
                    let dest = document.getElementById('speechVisualizerText');
                    if ( dest ) {
                        dest.innerHTML = event.detail.id+" : "+event.detail.stable;
                    }
                });
                break;

            case 'interim':
            default:
                ContinuousVoice.addEventListener('interimResult',(event) => {  
                    // console.log('interimResult event.detail =',event.detail) 
                    let dest = document.getElementById('speechVisualizerText');
                    if ( dest ) {
                        dest.innerHTML = event.detail.id+" : "+event.detail.interim;
                    }
                });
                break;
        }
    }
    // setup display for specific speech events
    if ( document.getElementById('interimVisualizer') ) {
        // console.log('init interim visualizer')
        ContinuousVoice.addEventListener('interimResult',(event) => {   
            document.getElementById('interimVisualizerText').innerHTML = event.detail.id+" : "+event.detail.interim;
        });
    }
    if ( document.getElementById('stableVisualizer') ) {
        // console.log('init stable visualizer')
        ContinuousVoice.addEventListener('stableResult',(event) => {   
            document.getElementById('stableVisualizerText').innerHTML = event.detail.id+" : "+event.detail.stable;
        });
    }
    if ( document.getElementById('finalVisualizer') ) {
        // console.log('init final visualizer')
        ContinuousVoice.addEventListener('finalResult',(event) => {   
            document.getElementById('finalVisualizerText').innerHTML = event.detail.id+" : "+event.detail.transcript;
        });
    }
    if ( document.getElementById('logVisualizer') ) {
        // console.log('init final visualizer')
        ContinuousVoice.addEventListener('finalResult',(event) => {   
            let log_area = document.getElementById('logVisualizerText')
            if ( log_area ) {
                let transcript_log = document.createElement('div')
                transcript_log.id = 'transcript-log-'+event.detail.id
                transcript_log.classList.add('transcript-log')
                transcript_log.innerHTML = event.detail.id+" : "+event.detail.transcript
                log_area.prepend(transcript_log)
            }
        });
    }

    resetListener();
    // ContinuousVoice.startListening();
});