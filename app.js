document.addEventListener("DOMContentLoaded", () => {
    // App Install Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW failed: ', err));
    }

    const newsGrid = document.getElementById("news-grid");
    const loader = document.getElementById("loader");
    const audioContainer = document.getElementById("audio-container");
    const globalAudioPlayer = document.getElementById("global-audio-player");
    const audioStatus = document.getElementById("audio-status");
    const langSelector = document.getElementById("lang-selector");
    const moodBtns = document.querySelectorAll(".mood-btn");
    
    // Tab Elements
    const tabBtns = document.querySelectorAll(".tab-btn");
    const newsTabView = document.getElementById("news-tab-view");
    const mediaTabView = document.getElementById("media-tab-view");

    // Media Analyzer Elements
    const mediaUploadInput = document.getElementById("media-upload");
    const uploadBox = document.getElementById("upload-box");
    const mediaPreviewBox = document.getElementById("media-preview-box");
    const btnAnalyzeMedia = document.getElementById("btn-analyze-media");
    const btnDeleteMedia = document.getElementById("btn-delete-media");
    const mediaAnalysisResult = document.getElementById("media-analysis-result");

    let currentMood = "";
    let currentMediaFile = null;

    // Fetch News on load
    fetchNews(langSelector.value, currentMood);

    // Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            tabBtns.forEach(b => b.classList.remove("active"));
            e.currentTarget.classList.add("active");
            
            const target = e.currentTarget.dataset.tab;
            if (target === "news-tab-view") {
                newsTabView.classList.remove("hidden");
                mediaTabView.classList.add("hidden");
            } else {
                newsTabView.classList.add("hidden");
                mediaTabView.classList.remove("hidden");
            }
        });
    });

    // Reload news when language changes
    langSelector.addEventListener("change", (e) => {
        handleReload();
        // Clear media analysis if language changes to force re-analysis
        mediaAnalysisResult.innerHTML = "";
        mediaAnalysisResult.classList.add("hidden");
    });

    // Reload news when a mood is selected
    moodBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            moodBtns.forEach(b => b.classList.remove("active"));
            e.currentTarget.classList.add("active");
            currentMood = e.currentTarget.dataset.mood;
            handleReload();
        });
    });

    function handleReload() {
        if (!newsTabView.classList.contains("hidden")) {
            loader.classList.remove("hidden");
            newsGrid.classList.add("hidden");
            fetchNews(langSelector.value, currentMood);
        }
    }

    // --- MEDIA ANALYZER LOGIC ---

    // Click upload box to trigger input
    uploadBox.addEventListener("click", () => mediaUploadInput.click());

    // Drag and Drop
    uploadBox.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadBox.classList.add("dragover");
    });
    uploadBox.addEventListener("dragleave", () => {
        uploadBox.classList.remove("dragover");
    });
    uploadBox.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadBox.classList.remove("dragover");
        if (e.dataTransfer.files.length) {
            handleMediaFile(e.dataTransfer.files[0]);
        }
    });

    // File Input change
    mediaUploadInput.addEventListener("change", (e) => {
        if (e.target.files.length) {
            handleMediaFile(e.target.files[0]);
        }
    });

    function handleMediaFile(file) {
        currentMediaFile = file;
        const fileUrl = URL.createObjectURL(file);
        
        mediaPreviewBox.innerHTML = "";
        mediaPreviewBox.classList.remove("hidden");
        
        if (file.type.startsWith("video/")) {
            const vid = document.createElement("video");
            vid.src = fileUrl;
            vid.controls = true;
            mediaPreviewBox.appendChild(vid);
        } else {
            const img = document.createElement("img");
            img.src = fileUrl;
            mediaPreviewBox.appendChild(img);
        }

        btnAnalyzeMedia.disabled = false;
        btnDeleteMedia.disabled = false;
        mediaAnalysisResult.classList.add("hidden");
        mediaAnalysisResult.innerHTML = "";
    }

    btnDeleteMedia.addEventListener("click", () => {
        currentMediaFile = null;
        mediaUploadInput.value = "";
        mediaPreviewBox.innerHTML = "";
        mediaPreviewBox.classList.add("hidden");
        mediaAnalysisResult.innerHTML = "";
        mediaAnalysisResult.classList.add("hidden");
        btnAnalyzeMedia.disabled = true;
        btnDeleteMedia.disabled = true;
        btnAnalyzeMedia.innerHTML = '<i class="fa-solid fa-brain"></i> Analyze Media Context';
    });

    btnAnalyzeMedia.addEventListener("click", async () => {
        if (!currentMediaFile) return;

        btnAnalyzeMedia.disabled = true;
        btnAnalyzeMedia.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing Media...';
        mediaAnalysisResult.classList.remove("hidden");
        mediaAnalysisResult.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0 auto;"></div><p style="text-align:center;margin-top:10px;">Extracting and analyzing...</p>';

        const formData = new FormData();
        formData.append("file", currentMediaFile);
        formData.append("lang", langSelector.value);

        try {
            const res = await fetch("/analyze", {
                method: "POST",
                body: formData
            });

            if (!res.ok) throw new Error("Analysis failed on server.");
            
            const data = await res.json();
            
            mediaAnalysisResult.innerHTML = `<strong>🧠 Brain Readout:</strong> ${data.analysis} 
            <br/><br/>
            <button class="btn btn-play" id="btn-play-media-analysis" style="display:inline-block; width:auto;">
                <i class="fa-solid fa-play"></i> Play Audio
            </button>`;

            btnAnalyzeMedia.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Re-Analyze Media';
            btnAnalyzeMedia.disabled = false;

            // Audio for Analyzer
            const btnPlayMedia = document.getElementById("btn-play-media-analysis");
            btnPlayMedia.addEventListener("click", async () => {
                btnPlayMedia.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Details...';
                btnPlayMedia.disabled = true;
                
                try {
                    const audioRes = await fetch("/voice", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text: data.analysis, lang: langSelector.value })
                    });
                    
                    if (!audioRes.ok) throw new Error("Voice API failed");
                    const audioData = await audioRes.json();
                    
                    audioContainer.classList.remove("hidden");
                    globalAudioPlayer.src = audioData.audioPath;
                    globalAudioPlayer.play();
                    audioStatus.textContent = `Playing Analysis...`;
                    
                    btnPlayMedia.innerHTML = '<i class="fa-solid fa-volume-high"></i> Play Again';
                    btnPlayMedia.disabled = false;
                } catch (err) {
                    console.error(err);
                    btnPlayMedia.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Error';
                    btnPlayMedia.disabled = false;
                }
            });

        } catch (err) {
            console.error(err);
            mediaAnalysisResult.innerHTML = `<p style="color:#ef4444;">Analysis Error: ${err.message}</p>`;
            btnAnalyzeMedia.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Retry';
            btnAnalyzeMedia.disabled = false;
        }
    });

    // --- NEWS FETCH LOGIC ---

    async function fetchNews(lang, mood) {
        try {
            const response = await fetch(`/news?lang=${lang}&mood=${mood}`);
            if (!response.ok) throw new Error("Failed to fetch news");
            
            const articles = await response.json();
            loader.classList.add("hidden");
            newsGrid.classList.remove("hidden");
            
            if(articles.length === 0) {
                newsGrid.innerHTML = "<p>No news found. Try a different mood.</p>";
                return;
            }

            renderArticles(articles, lang);
        } catch (error) {
            console.error(error);
            loader.innerHTML = `<p style="color: #ef4444;">Error loading news: ${error.message} <br/> (Check your internet or backend)</p>`;
        }
    }

    function renderArticles(articles, currentLang) {
        newsGrid.innerHTML = "";
        articles.forEach((article, index) => {
            const card = document.createElement("div");
            card.className = "news-card";
            
            const imageUrl = article.image || "https://placehold.co/600x400/2c3e50/ffffff?text=No+Image";
            
            card.innerHTML = `
                <img src="${imageUrl}" alt="News Image" class="news-image" onerror="this.src='https://placehold.co/600x400/2c3e50/ffffff?text=Image+Load+Error'">
                <div class="news-content">
                    <h2 class="news-title"><a href="${article.url}" target="_blank">${article.title}</a></h2>
                    <p class="news-description" id="desc-${index}">${article.description || "No description available."}</p>
                    
                    <div id="summary-box-${index}" class="news-summary-box hidden">
                        <div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div>
                        <span style="margin-left: 10px;">Processing...</span>
                    </div>

                    <div class="buttons-container">
                        <button class="btn btn-ai" id="btn-sum-${index}">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> Summarize
                        </button>
                        <button class="btn btn-play hidden" id="btn-play-${index}">
                            <i class="fa-solid fa-play"></i> Play Audio
                        </button>
                        <a href="${article.url}" target="_blank" class="btn btn-read">
                            <i class="fa-solid fa-book-open"></i> Read Full
                        </a>
                    </div>
                </div>
            `;
            
            newsGrid.appendChild(card);

            // Event Listeners
            const btnSum = document.getElementById(`btn-sum-${index}`);
            const btnPlay = document.getElementById(`btn-play-${index}`);
            const summaryBox = document.getElementById(`summary-box-${index}`);
            const descElem = document.getElementById(`desc-${index}`);

            btnSum.addEventListener("click", async () => {
                const textToSummarize = article.description || article.title;
                btnSum.disabled = true;
                summaryBox.classList.remove("hidden");
                descElem.classList.add("hidden"); 
                btnSum.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
                
                try {
                    // Fetch Summary with targeting language
                    const sumRes = await fetch("/summary", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text: textToSummarize, lang: currentLang })
                    });
                    
                    if (!sumRes.ok) throw new Error("Summary API failed");
                    const sumData = await sumRes.json();
                    const summaryText = sumData.summary;
                    
                    summaryBox.innerHTML = `<strong>AI Summary:</strong> ${summaryText}`;
                    btnSum.classList.add("hidden"); 
                    btnPlay.classList.remove("hidden"); 

                    // Set up TTS
                    btnPlay.addEventListener("click", async () => {
                        btnPlay.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
                        btnPlay.disabled = true;
                        
                        try {
                            const audioRes = await fetch("/voice", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ text: summaryText, lang: currentLang })
                            });
                            
                            if (!audioRes.ok) throw new Error("Voice API failed");
                            const audioData = await audioRes.json();
                            
                            audioContainer.classList.remove("hidden");
                            globalAudioPlayer.src = audioData.audioPath;
                            globalAudioPlayer.play();
                            audioStatus.textContent = `Playing...`;
                            
                            btnPlay.innerHTML = '<i class="fa-solid fa-volume-high"></i> Play Again';
                            btnPlay.disabled = false;
                        } catch (err) {
                            console.error(err);
                            btnPlay.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Error';
                            btnPlay.disabled = false;
                        }
                    });
                    
                } catch (err) {
                    summaryBox.innerHTML = `<span style="color:#ef4444;">Error generating summary. Make sure backend is running.</span>`;
                    btnSum.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Retry';
                    btnSum.disabled = false;
                    console.error(err);
                }
            });
        });
    }
});
