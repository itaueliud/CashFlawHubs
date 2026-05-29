import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ApplicantEmailBadge from './ApplicantEmailBadge';

describe('ApplicantEmailBadge', () => {
  it('shows the sent state with the success styling', () => {
    render(<ApplicantEmailBadge sent />);

    const badge = screen.getByText('Email sent');

    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-emerald-500/10');
    expect(badge).toHaveClass('text-emerald-300');
  });

  it('shows the pending state by default', () => {
    render(<ApplicantEmailBadge />);

    const badge = screen.getByText('Email pending');

    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-amber-500/10');
    expect(badge).toHaveClass('text-amber-300');
  });

  it('appends custom class names', () => {
    render(<ApplicantEmailBadge sent className="extra-class" />);

    expect(screen.getByText('Email sent')).toHaveClass('extra-class');
  });
});