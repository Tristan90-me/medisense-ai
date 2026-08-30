import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import api from '../api/axios';
import toast from 'react-hot-toast';

// No real network calls: axios instance is fully mocked.
vi.mock('../api/axios', () => ({
  default: { post: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSetAuth = vi.fn();
const mockSetPendingEmail = vi.fn();
const mockSetDeviceToken = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    setAuth: mockSetAuth,
    setDeviceToken: mockSetDeviceToken,
    setPendingEmail: mockSetPendingEmail,
    deviceToken: null,
  }),
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the sign-in form', () => {
    renderLogin();

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('updates the email and password fields as the user types', async () => {
    const user = userEvent.setup();
    renderLogin();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await user.type(emailInput, 'jane@example.com');
    await user.type(passwordInput, 'hunter2');

    expect(emailInput).toHaveValue('jane@example.com');
    expect(passwordInput).toHaveValue('hunter2');
  });

  it('navigates to /verify-otp and stores the pending email when the API returns an OTP step', async () => {
    api.post.mockResolvedValueOnce({ data: { step: 'otp' } });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/password/i), 'hunter2');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/verify-otp'));
    expect(mockSetPendingEmail).toHaveBeenCalledWith('jane@example.com');
    expect(mockSetAuth).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'jane@example.com',
      password: 'hunter2',
      deviceToken: null,
    });
  });

  it('calls setAuth and navigates to /dashboard when the API returns step: done', async () => {
    const user = { id: 'u1', name: 'Jane Doe' };
    api.post.mockResolvedValueOnce({ data: { step: 'done', user, token: 'tok-123' } });
    const ue = userEvent.setup();
    renderLogin();

    await ue.type(screen.getByLabelText(/email/i), 'jane@example.com');
    await ue.type(screen.getByLabelText(/password/i), 'hunter2');
    await ue.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
    expect(mockSetAuth).toHaveBeenCalledWith(user, 'tok-123');
    expect(toast.success).toHaveBeenCalledWith('Welcome back!');
  });

  it('shows an error toast when login fails', async () => {
    api.post.mockRejectedValueOnce({
      response: { data: { message: 'Invalid credentials' } },
    });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Invalid credentials'));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockSetAuth).not.toHaveBeenCalled();
  });

  it('redirects to /check-email when login fails with an unverified email', async () => {
    api.post.mockRejectedValueOnce({
      response: { data: { message: 'Please verify your email', code: 'EMAIL_NOT_VERIFIED' } },
    });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/password/i), 'hunter2');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/check-email', { state: { email: 'jane@example.com' } })
    );
    expect(toast.error).toHaveBeenCalledWith('Please verify your email');
  });
});
