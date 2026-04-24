import re

with open('index.html', 'r') as f:
    content = f.read()

css_rules = """
/* Premium Dark Sharp Mode Customizations */
body.sharp-mode .mx,
body.sharp-mode .dbg-x,
body.sharp-mode .theater-close-btn,
body.sharp-mode .mhd button.mx {
    width: auto !important;
    height: auto !important;
    padding: 6px 12px;
    border-radius: 0;
    border: 1px solid rgba(255, 255, 255, 0.4);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.02));
    font-family: var(--font-family);
    font-size: 14px;
    font-weight: bold;
    text-transform: uppercase;
    color: #fff;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    gap: 8px;
}

body.sharp-mode .mx::before,
body.sharp-mode .dbg-x::before,
body.sharp-mode .theater-close-btn::before {
    content: "CLOSE";
}

body.sharp-mode .mx:hover,
body.sharp-mode .dbg-x:hover,
body.sharp-mode .theater-close-btn:hover {
    background: rgba(255,255,255,0.2);
    box-shadow: 0 4px 15px rgba(255, 255, 255, 0.1);
}
"""

# Insert CSS right before </style>
content = content.replace("</style>", css_rules + "\n</style>")

with open('index.html', 'w') as f:
    f.write(content)
