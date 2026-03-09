'use client';

import Link from 'next/link';

export default function Navbar() {
    return (
        <nav className="navbar">
            <div className="navbar-inner">
                <Link href="/" className="navbar-logo">
                    <span className="logo-icon">◆</span>
                    <span>DAO<span className="gradient-text">Sense</span></span>
                </Link>

                <div className="navbar-links">
                    <Link href="/">Dashboard</Link>
                    <a href="https://github.com/daosense" target="_blank" rel="noopener noreferrer">
                        GitHub
                    </a>
                    <span className="navbar-badge">
                        <span className="pulse-dot" />
                        Avalanche
                    </span>
                </div>
            </div>
        </nav>
    );
}
