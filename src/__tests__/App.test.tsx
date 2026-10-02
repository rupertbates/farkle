import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

describe('App integration', () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    randomSpy.mockRestore();
  });

  beforeEach(() => {
    // Force every die to show a 1 so rolls always score and never Farkle.
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.05); // -> floor(0.05*6)+1 = 1
  });

  it('renders the scoreboard and lets the human roll, see advice, and bank points', async () => {
    render(<App />);

    expect(screen.getByText('Your turn')).toBeInTheDocument();

    const rollButton = screen.getByRole('button', { name: /roll 6 dice/i });
    fireEvent.click(rollButton);

    // All dice show 1s -> advisor should recommend taking all 6 (six of a kind of 1s = 8000).
    expect(await screen.findByText(/Advisor/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select recommended dice/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /select recommended dice/i }));

    expect(await screen.findByText(/Bank 8,?000 pts & end turn/)).toBeInTheDocument();
  });
});
