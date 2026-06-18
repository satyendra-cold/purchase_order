import React from 'react';

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="w-full border-t border-border bg-background/50 backdrop-blur-sm py-4 px-4 md:px-6 text-center text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2 mt-auto">
      <div>
        &copy; {currentYear} ProcureFlow. All rights reserved.
      </div>
      <div className="flex items-center gap-1.5 tracking-wide">
        Powered by{' '}
        <a 
          href="https://www.botivate.in" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="font-medium text-foreground hover:underline transition-colors"
        >
          Botivate
        </a>
      </div>
    </footer>
  );
}
