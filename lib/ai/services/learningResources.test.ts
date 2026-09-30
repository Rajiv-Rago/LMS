import { selectLearningResources } from './learningResources';
import { searchWeb, readWebPage } from './webResearch';
jest.mock('./webResearch', () => ({ searchWeb: jest.fn(), readWebPage: jest.fn() }));
const provider = { generateText: jest.fn() };
const request = { courseTitle: 'Calculus', lessonTitle: 'Limits', targetLevel: 'beginner' };
beforeEach(() => {
  jest.resetAllMocks();
  (searchWeb as jest.Mock).mockResolvedValue([{ url: 'https://example.com/limits', title: 'Limits' }]);
  (readWebPage as jest.Mock).mockResolvedValue({ url: 'https://example.com/limits', title: 'Limits', text: 'Free tutorial: learn limits with worked examples. No cost. Create a free account to practice.' });
  provider.generateText.mockResolvedValue({ content: JSON.stringify([{ title: 'Limits practice', url: 'https://example.com/limits', description: 'Practice limits with worked examples.', type: 'exercise', requiresSignup: true, evidence: 'Create a free account to practice' }]) });
});
it('recommends inspected free content with signup labels', async () => {
  expect(await selectLearningResources(provider as never, request)).toEqual([expect.objectContaining({ requiresSignup: true, type: 'exercise' })]);
});
it('rejects fabricated URLs', async () => {
  provider.generateText.mockResolvedValue({ content: JSON.stringify([{ url: 'https://invented.com', title: 'Fake', description: 'Fake', type: 'video', evidence: 'Free tutorial' }]) });
  expect(await selectLearningResources(provider as never, request)).toEqual([]);
});
it('rejects trials and pages with unclear access', async () => {
  (readWebPage as jest.Mock).mockResolvedValue({ url: 'https://example.com/limits', title: 'Limits', text: 'Start your free trial. Subscribe to access this tutorial.' });
  expect(await selectLearningResources(provider as never, request)).toEqual([]);
});
it('returns fewer recommendations when inspection fails', async () => {
  (readWebPage as jest.Mock).mockRejectedValue(new Error('unavailable'));
  expect(await selectLearningResources(provider as never, request)).toEqual([]);
});
it('surfaces search failure so refresh can preserve existing recommendations', async () => {
  (searchWeb as jest.Mock).mockRejectedValue(new Error('Search unavailable'));
  await expect(selectLearningResources(provider as never, request)).rejects.toThrow('Search unavailable');
});
it('aims for five inspected recommendations', async () => {
  const entries = Array.from({ length: 6 }, (_, index) => ({ title: `Resource ${index}`, url: `https://example.com/${index}`, description: 'Practice limits.', type: 'tutorial', requiresSignup: false, evidence: 'Free tutorial with worked examples' }));
  (searchWeb as jest.Mock).mockResolvedValue(entries);
  (readWebPage as jest.Mock).mockImplementation(async url => ({ url, title: 'Tutorial', text: 'Free tutorial with worked examples' }));
  provider.generateText.mockResolvedValue({ content: JSON.stringify(entries) });
  expect(await selectLearningResources(provider as never, request)).toHaveLength(5);
  expect(searchWeb).toHaveBeenCalledWith(expect.any(String), 10);
});
