<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Configure Visible Use Cases</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 2rem;
        }
        h1 {
            margin-bottom: 0.5rem;
        }
        .description {
            margin-bottom: 1rem;
            color: #555;
        }

        .category {
            border: 1px solid #eee;
            border-radius: 4px;
            padding: 0.75rem 0.9rem;
            margin-bottom: 0.75rem;
        }
        .category-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.5rem;
        }
        .category-header strong {
            font-size: 1rem;
        }

        .usecase-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 0.4rem 1.2rem;
            margin: 0.4rem 0 0.2rem 1.4rem;
        }
        .usecase-item {
            padding: 0.15rem 0;
        }
        .buttons {
            margin-top: 1rem;
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }
        button {
            padding: 0.4rem 0.9rem;
            border-radius: 4px;
            border: 1px solid #ccc;
            background: #f5f5f5;
            cursor: pointer;
        }
        button:hover {
            background: #e8e8e8;
        }
        .message {
            margin-top: 1rem;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            display: none;
        }
        .message.ok {
            background: #e0ffe0;
            border: 1px solid #6bbf6b;
        }
        .message.err {
            background: #ffe0e0;
            border: 1px solid #bf6b6b;
        }
        pre {
            background: #f4f4f4;
            padding: 0.8rem;
            border-radius: 4px;
            max-width: 800px;
            overflow-x: auto;
            font-size: 0.85rem;
        }
        a.back-link {
            display: inline-block;
            margin-bottom: 1rem;
            font-size: 0.9rem;
        }
    </style>

</head>
<body>
    <a href="../" class="back-link">&larr; Back to main page</a>
    <h1>Configure Visible Use Cases</h1>
    <p class="description">
        Select which use cases should be visible in the main demo navigation.
        The selection is stored in <code>config/activeUsecases.json</code> as:
        <code>{"visibleUseCases": [...]}</code>.
    </p>

    <div id="usecase-list" class="usecase-list"></div>

    <div class="buttons">
        <button type="button" id="select-all">Select all</button>
        <button type="button" id="select-none">Select none</button>
        <button type="button" id="save">Save configuration</button>
    </div>

    <div id="message" class="message"></div>

    <h2>Current JSON</h2>
    <pre id="current-json">Loading...</pre>

<script>
// === PARSE NAV STRUCTURE FROM ../index.html =========================

// Read index.html, find categories (<h3>) and links (<a href="#id">)
async function loadStructure() {
    const res = await fetch('../index.html?nocache=' + Date.now());
    if (!res.ok) {
        throw new Error('Failed to fetch index.html: HTTP ' + res.status);
    }
    const html = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // All anchors with href="#..." anywhere in the page
    const allAnchors = Array.from(doc.querySelectorAll('a[href^="#"]'));

    // Categories from <h3> followed by <a> siblings
    const categories = [];
    const assignedIds = new Set();

    const h3s = Array.from(doc.querySelectorAll('h3'));
    h3s.forEach(h3 => {
        const name = h3.textContent.trim();
        const usecases = [];
        let el = h3.nextElementSibling;

        // Collect consecutive <a> after this <h3>
        while (el && el.tagName === 'A') {
            const href = el.getAttribute('href') || '';
            if (href.startsWith('#')) {
                const id = href.substring(1);
                const label = (el.textContent || '').trim() || id;
                usecases.push({ id, label });
                assignedIds.add(id);
            }
            el = el.nextElementSibling;
        }

        if (usecases.length > 0) {
            categories.push({ name, usecases });
        }
    });

    // Any anchors not in a <h3>-based category go into "General"
    const generalUsecases = [];
    allAnchors.forEach(a => {
        const href = a.getAttribute('href') || '';
        if (!href.startsWith('#')) return;
        const id = href.substring(1);
        if (assignedIds.has(id)) return;
        const label = (a.textContent || '').trim() || id;
        generalUsecases.push({ id, label });
    });

    if (generalUsecases.length > 0) {
        categories.unshift({
            name: 'General',
            usecases: generalUsecases
        });
    }

    return categories;
}

// === DOM ELEMENTS ====================================================

const container = document.getElementById('usecase-list');
const msgDiv = document.getElementById('message');
const jsonPre = document.getElementById('current-json');

// === UI BUILDING =====================================================

function buildUI(categories) {
    container.innerHTML = '';

    categories.forEach((cat, idx) => {
        if (!cat.usecases || cat.usecases.length === 0) return;

        const catDiv = document.createElement('div');
        catDiv.className = 'category';
        catDiv.dataset.categoryIndex = idx;

        const headerLabel = document.createElement('label');
        headerLabel.className = 'category-header';

        const catCheckbox = document.createElement('input');
        catCheckbox.type = 'checkbox';
        catCheckbox.className = 'category-checkbox';

        const catTitle = document.createElement('strong');
        catTitle.textContent = cat.name;

        headerLabel.appendChild(catCheckbox);
        headerLabel.appendChild(catTitle);
        catDiv.appendChild(headerLabel);

        const usecaseListDiv = document.createElement('div');
        usecaseListDiv.className = 'usecase-list';

        cat.usecases.forEach(uc => {
            const label = document.createElement('label');
            label.className = 'usecase-item';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.name = 'usecase';
            cb.value = uc.id;
            cb.className = 'usecase-checkbox';

            // When a single use-case checkbox changes, we update the category tri-state
            cb.addEventListener('change', () => {
                updateCategoryStates();
            });

            label.appendChild(cb);
            label.appendChild(document.createTextNode(' ' + uc.id));
            // if you prefer display label instead of ID:
            // label.appendChild(document.createTextNode(' ' + uc.label));
            usecaseListDiv.appendChild(label);
        });

        catDiv.appendChild(usecaseListDiv);
        container.appendChild(catDiv);

        // Category checkbox toggles all use cases in this category
        catCheckbox.addEventListener('change', () => {
            const checked = catCheckbox.checked;
            const childCheckboxes = catDiv.querySelectorAll('.usecase-checkbox');
            childCheckboxes.forEach(cb => {
                cb.checked = checked;
            });
            catCheckbox.indeterminate = false;
            updateCategoryStates();
        });
    });

    // Initial tri-state evaluation
    updateCategoryStates();
}

// === CATEGORY TRI-STATE LOGIC =======================================

function updateCategoryStates() {
    container.querySelectorAll('.category').forEach(catDiv => {
        const catCheckbox = catDiv.querySelector('.category-checkbox');
        const childCbs = catDiv.querySelectorAll('.usecase-checkbox');

        const total = childCbs.length;
        const checkedCount = Array.from(childCbs).filter(cb => cb.checked).length;

        if (checkedCount === 0) {
            catCheckbox.checked = false;
            catCheckbox.indeterminate = false;
        } else if (checkedCount === total) {
            catCheckbox.checked = true;
            catCheckbox.indeterminate = false;
        } else {
            catCheckbox.checked = false;
            catCheckbox.indeterminate = true;
        }
    });
}

// === CONFIG LOAD/SAVE ===============================================

function loadConfig() {
    fetch('./activeUsecases.json?nocache=' + Date.now())
        .then(r => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(data => {
            const visible = Array.isArray(data.visibleUseCases) ? data.visibleUseCases : [];

            document.querySelectorAll('input[name="usecase"]').forEach(cb => {
                cb.checked = visible.includes(cb.value);
            });

            updateCategoryStates();
            jsonPre.textContent = JSON.stringify(data, null, 2);
        })
        .catch(err => {
            console.error('Error loading activeUsecases.json:', err);
            jsonPre.textContent = 'Error loading activeUsecases.json: ' + err;
        });
}

function showMessage(text, ok = true) {
    msgDiv.textContent = text;
    msgDiv.className = 'message ' + (ok ? 'ok' : 'err');
    msgDiv.style.display = 'block';
}

// === BUTTONS ========================================================

document.getElementById('select-all').addEventListener('click', () => {
    document.querySelectorAll('input[name="usecase"]').forEach(cb => cb.checked = true);
    updateCategoryStates();
});

document.getElementById('select-none').addEventListener('click', () => {
    document.querySelectorAll('input[name="usecase"]').forEach(cb => cb.checked = false);
    updateCategoryStates();
});

document.getElementById('save').addEventListener('click', () => {
    const selected = Array.from(document.querySelectorAll('input[name="usecase"]:checked'))
        .map(cb => cb.value);

    const payload = {
        visibleUseCases: selected
    };

    fetch('../saveActiveUsecases.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                showMessage('Configuration saved successfully.', true);
                loadConfig();
            } else {
                showMessage('Failed to save: ' + (data.message || 'Unknown error'), false);
            }
        })
        .catch(err => {
            console.error('Error saving visibleUseCases:', err);
            showMessage('Error saving configuration: ' + err, false);
        });
});

// === INIT ===========================================================

(async function init() {
    try {
        const categories = await loadStructure();
        buildUI(categories);
        loadConfig();
    } catch (err) {
        console.error('Error initializing config UI:', err);
        jsonPre.textContent = 'Error initializing config UI: ' + err;
        showMessage('Failed to read structure from index.html. Check console for details.', false);
    }
})();
</script>



</body>
</html>
