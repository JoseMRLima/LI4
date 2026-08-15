import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function ManagementShortcuts({ items }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Link key={item.title} to={item.path} className="rounded-lg border bg-card p-4 transition hover:border-primary/50 hover:shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${item.tone}`}>
              <item.icon className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-semibold">{item.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
        </Link>
      ))}
    </div>
  );
}
