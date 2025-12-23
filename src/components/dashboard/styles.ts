// Custom calendar styles - Thorbit warm brown theme
export const calendarStyles = `
  .react-datepicker {
    border: none !important;
    box-shadow: none !important;
    font-family: inherit !important;
    font-size: 0.9rem !important;
    background-color: white !important;
  }

  .react-datepicker__month-container {
    background-color: white !important;
  }

  .react-datepicker__day {
    color: #3D3D3D !important;
    font-weight: 500 !important;
    transition: all 0.15s ease-in-out !important;
    width: 2.2rem !important;
    height: 2.2rem !important;
    line-height: 2.2rem !important;
    margin: 0.2rem !important;
    background-color: white !important;
  }

  .react-datepicker__day:hover {
    background-color: #8B7355 !important;
    color: white !important;
    transform: scale(1.05);
    border-radius: 0.375rem !important;
  }

  .react-datepicker__day--in-selecting-range:not(.react-datepicker__day--outside-month),
  .react-datepicker__day--in-range:not(.react-datepicker__day--outside-month) {
    background-color: #F5F0E8 !important;
    color: #6B5344 !important;
    font-weight: 500 !important;
    border-radius: 0 !important;
  }

  .react-datepicker__day--outside-month {
    background-color: transparent !important;
    color: #d1d5db !important;
    pointer-events: none !important;
  }

  .react-datepicker__day--selected,
  .react-datepicker__day--range-start,
  .react-datepicker__day--range-end,
  .react-datepicker__day--selecting-range-start,
  .react-datepicker__day--selecting-range-end {
    background-color: #8B7355 !important;
    color: white !important;
    font-weight: 700 !important;
    border-radius: 0.375rem !important;
  }

  .react-datepicker__day--keyboard-selected {
    background-color: #FAF8F5 !important;
    color: #3D3D3D !important;
    border-radius: 0.375rem !important;
  }

  .react-datepicker__day--today {
    font-weight: 700 !important;
    color: #8B7355 !important;
    border: 2px solid #8B7355 !important;
    border-radius: 0.375rem !important;
    background-color: white !important;
  }

  .react-datepicker__day--disabled {
    color: #d1d5db !important;
    cursor: not-allowed !important;
    background-color: #FAF8F5 !important;
  }

  .react-datepicker__day--disabled:hover {
    background-color: #FAF8F5 !important;
    transform: none !important;
  }

  .react-datepicker__header {
    background-color: #FAF8F5 !important;
    border-bottom: 2px solid #E8E4DE !important;
    padding-top: 0.75rem !important;
    padding-bottom: 0.5rem !important;
  }

  .react-datepicker__current-month {
    color: #3D3D3D !important;
    font-weight: 700 !important;
    font-size: 0.95rem !important;
    margin-bottom: 0.75rem !important;
  }

  .react-datepicker__day-name {
    color: #6B5344 !important;
    font-weight: 600 !important;
    width: 2.2rem !important;
    line-height: 2.2rem !important;
    margin: 0.2rem !important;
    font-size: 0.8rem !important;
  }

  .react-datepicker__navigation {
    top: 0.75rem !important;
  }

  .react-datepicker__navigation-icon::before {
    border-color: #8B7355 !important;
    border-width: 2px 2px 0 0 !important;
  }

  .react-datepicker__navigation:hover *::before {
    border-color: #6B5344 !important;
  }

  .react-datepicker__month {
    margin: 0.75rem !important;
    background-color: white !important;
  }

  .react-datepicker__week {
    background-color: white !important;
  }
`;
