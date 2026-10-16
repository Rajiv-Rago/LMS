/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import CourseConfigModal from "./CourseConfigModal";
jest.mock("@/components/ai/ModelSelector", () => ({ ModelSelector: () => null }));

it("allows a pasted description beyond the old limit without losing text", () => {
  const onContinue = jest.fn();
  render(<CourseConfigModal initialTopic="Python" onClose={jest.fn()} onContinue={onContinue} />);
  const description = "Learn practical Python. ".repeat(400);
  fireEvent.change(screen.getByLabelText("Details, topics, or course description"), { target: { value: description } });
  fireEvent.click(screen.getByRole("button", { name: "Continue to course planning" }));
  expect(onContinue).toHaveBeenCalledWith(expect.objectContaining({ additionalContext: description.trim() }));
});

it("retains oversized details for editing and blocks submission until corrected", () => {
  const onContinue = jest.fn();
  render(<CourseConfigModal initialTopic="Python" onClose={jest.fn()} onContinue={onContinue} />);
  const details = screen.getByLabelText("Details, topics, or course description");
  const description = "x".repeat(20001);
  fireEvent.change(details, { target: { value: description } });
  expect(details).toHaveValue(description);
  expect(screen.getByRole("alert")).toHaveTextContent("Keep course details to 20,000 characters");
  expect(screen.getByRole("button", { name: "Continue to course planning" })).toBeDisabled();
  expect(onContinue).not.toHaveBeenCalled();
  fireEvent.change(details, { target: { value: description.slice(0, 20000) } });
  expect(screen.getByRole("button", { name: "Continue to course planning" })).toBeEnabled();
});

it("catches an oversized topic inherited from the dashboard", () => {
  render(<CourseConfigModal initialTopic={"x".repeat(501)} onClose={jest.fn()} onContinue={jest.fn()} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Put the full description in Details");
  expect(screen.getByRole("button", { name: "Continue to course planning" })).toBeDisabled();
});
