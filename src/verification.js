export function displayVerificationResults(result) {
    const verificationPanel = document.getElementById('verificationPanel');
    const verificationBadge = document.getElementById('verificationBadge');
    const similarityFill = document.getElementById('similarityFill');
    const criticalErrorsSection = document.getElementById('criticalErrorsSection');
    const criticalErrorsList = document.getElementById('criticalErrorsList');
    const structuralDifferencesSection = document.getElementById('structuralDifferencesSection');
    const structuralDifferencesList = document.getElementById('structuralDifferencesList');
    const textAccuracySection = document.getElementById('textAccuracySection');
    const textAccuracyList = document.getElementById('textAccuracyList');
    const semanticIntegrity = document.getElementById('semanticIntegrity');
    const overallAssessment = document.getElementById('overallAssessment');

    verificationPanel.classList.add('active');

    let badgeClass = 'badge-no-text';
    let badgeText = 'No Embedded Text';

    if (result.hasEmbeddedText) {
        if (result.similarity >= 95) {
            badgeClass = 'badge-excellent';
            badgeText = 'Excellent';
        } else if (result.similarity >= 85) {
            badgeClass = 'badge-good';
            badgeText = 'Good';
        } else if (result.similarity >= 70) {
            badgeClass = 'badge-fair';
            badgeText = 'Fair';
        } else {
            badgeClass = 'badge-poor';
            badgeText = 'Poor';
        }
    }

    verificationBadge.className = `verification-badge ${badgeClass}`;
    verificationBadge.textContent = badgeText;

    similarityFill.style.width = `${result.similarity}%`;
    similarityFill.textContent = `${result.similarity}%`;

    if (result.similarity < 70) {
        similarityFill.style.background = 'linear-gradient(90deg, #dc3545, #c82333)';
    } else if (result.similarity < 85) {
        similarityFill.style.background = 'linear-gradient(90deg, #ffc107, #ff9800)';
    } else if (result.similarity < 95) {
        similarityFill.style.background = 'linear-gradient(90deg, #17a2b8, #138496)';
    } else {
        similarityFill.style.background = 'linear-gradient(90deg, #28a745, #20c997)';
    }

    function populateList(section, list, items) {
        if (items && items.length > 0) {
            section.style.display = 'block';
            list.replaceChildren(...items.map(text => Object.assign(document.createElement('li'), { textContent: text })));
        } else {
            section.style.display = 'none';
        }
    }

    populateList(criticalErrorsSection, criticalErrorsList, result.criticalErrors);
    populateList(structuralDifferencesSection, structuralDifferencesList, result.structuralDifferences);
    populateList(textAccuracySection, textAccuracyList, result.textAccuracyIssues);

    semanticIntegrity.textContent = result.semanticIntegrity;
    overallAssessment.textContent = result.overallAssessment;
}
