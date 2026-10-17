'use client';

import React, { useMemo, useState } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';

const PASSWORD_REQUIREMENTS = [
  { regex: /.{8,}/, text: 'At least 8 characters' },
  { regex: /[0-9]/, text: 'At least 1 number' },
  { regex: /[a-z]/, text: 'At least 1 lowercase letter' },
  { regex: /[A-Z]/, text: 'At least 1 uppercase letter' },
  { regex: /[!-\/:-@[-`{-~]/, text: 'At least 1 special characters' },
] as const;

type StrengthScore = 0 | 1 | 2 | 3 | 4 | 5;

const STRENGTH_CONFIG = {
  colors: {
    0: 'bg-border',
    1: 'bg-red-500',
    2: 'bg-orange-500',
    3: 'bg-amber-500',
    4: 'bg-amber-700',
    5: 'bg-emerald-500',
  } satisfies Record<StrengthScore, string>,
  texts: {
    0: 'Enter a password',
    1: 'Weak password',
    2: 'Medium password!',
    3: 'Strong password!!',
    4: 'Very Strong password!!!',
  } satisfies Record<Exclude<StrengthScore, 5>, string>,
} as const;

type Requirement = {
  met: boolean;
  text: string;
};

type PasswordStrength = {
  score: StrengthScore;
  requirements: Requirement[];
};

const PasswordInput = () => {
  const [password, setPassword] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  const calculateStrength = useMemo((): PasswordStrength => {
    const requirements = PASSWORD_REQUIREMENTS.map((req) => ({
      met: req.regex.test(password),
      text: req.text,
    }));

    return {
      score: requirements.filter((req) => req.met).length as StrengthScore,
      requirements,
    };
  }, [password]);

  return (
    <div className="mx-auto w-96">
      <form className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={isVisible ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            aria-invalid={calculateStrength.score < 4}
            aria-describedby="password-strength"
            className="w-full rounded-md border-2 bg-background p-2 outline-none transition focus-within:border-blue-700"
          />
          <button
            type="button"
            onClick={() => setIsVisible((previous) => !previous)}
            aria-label={isVisible ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground/80"
          >
            {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </form>

      <div
        className="mb-4 mt-3 h-1 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={calculateStrength.score}
        aria-valuemin={0}
        aria-valuemax={4}
      >
        <div
          className={`h-full ${STRENGTH_CONFIG.colors[calculateStrength.score]} transition-all duration-500`}
          style={{ width: `${(calculateStrength.score / 5) * 100}%` }}
        />
      </div>

      <p id="password-strength" className="mb-2 flex justify-between text-sm font-medium">
        <span>Must contain:</span>
        <span>
          {STRENGTH_CONFIG.texts[
            Math.min(calculateStrength.score, 4) as keyof typeof STRENGTH_CONFIG.texts
          ]}
        </span>
      </p>

      <ul className="space-y-1.5" aria-label="Password requirements">
        {calculateStrength.requirements.map((requirement, index) => (
          <li key={index} className="flex items-center space-x-2">
            {requirement.met ? (
              <Check size={16} className="text-emerald-500" />
            ) : (
              <X size={16} className="text-muted-foreground/80" />
            )}
            <span
              className={`text-xs ${requirement.met ? 'text-emerald-600' : 'text-muted-foreground'}`}
            >
              {requirement.text}
              <span className="sr-only">
                {requirement.met ? ' - Requirement met' : ' - Requirement not met'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordInput;
